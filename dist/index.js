"use strict";
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const prettier_1 = __importDefault(require("prettier"));
const axios_1 = __importDefault(require("axios"));
const definitionCodegen_1 = require("./definitionCodegen");
const template_1 = require("./template");
const requestCodegen_1 = require("./requestCodegen");
const utils_1 = require("./utils");
const defaultOptions = {
    serviceNameSuffix: 'Service',
    enumNamePrefix: 'Enum',
    methodNameMode: 'operationId',
    outputDir: './service',
    fileName: 'index.ts',
    useStaticMethod: true,
    useCustomerRequestInstance: false,
    include: []
};
async function codegen(params) {
    console.time('finish');
    let swaggerSource;
    if (params.remoteUrl) {
        const { data: swaggerJson } = await axios_1.default({ url: params.remoteUrl, responseType: 'text' });
        if (Object.prototype.toString.call(swaggerJson) === '[object String]') {
            fs.writeFileSync('./cache_swagger.json', swaggerJson);
            swaggerSource = require(path.resolve('./cache_swagger.json'));
        }
        else {
            swaggerSource = swaggerJson;
        }
    }
    else if (params.source) {
        swaggerSource = params.source;
    }
    else {
        throw new Error('remoteUrl or source must have a value');
    }
    const options = {
        ...defaultOptions,
        ...params
    };
    let apiSource = options.useCustomerRequestInstance
        ? template_1.customerServiceHeader
        : template_1.serviceHeader;
    // TODO: next next next time
    // if (options.multipleFileMode) {
    if (false) {
        const { models, enums } = definitionCodegen_1.definitionsCodeGen(swaggerSource.definitions);
        // enums
        Object.values(enums).forEach(item => {
            const text = item.value
                ? template_1.enumTemplate(item.value.name, item.value.enumProps, 'Enum')
                : item.content || '';
            const fileDir = path.join(options.outputDir || '', 'definitions');
            writeFile(fileDir, item.name + '.ts', format(text));
        });
        Object.values(models).forEach(item => {
            const text = template_1.classTemplate(item.value.name, item.value.props, item.value.imports);
            const fileDir = path.join(options.outputDir || '', 'definitions');
            writeFile(fileDir, item.name, format(text));
        });
    }
    else if (options.include && options.include.length > 0) {
        let reqSource = '';
        let defSource = '';
        let requestClasses = Object.entries(requestCodegen_1.requestCodegen(swaggerSource.paths));
        const { models, enums } = definitionCodegen_1.definitionsCodeGen(swaggerSource.definitions);
        let allModel = Object.values(models);
        let allEnum = Object.values(enums);
        let allImport = [];
        options.include.forEach(item => {
            let includeClassName = '';
            let includeRequests = null;
            if (Object.prototype.toString.call(item) === '[object String]') {
                includeClassName = item;
            }
            else {
                for (let k of Object.keys(item)) {
                    includeClassName = k;
                    includeRequests = item[k];
                }
            }
            for (let [className, requests] of requestClasses) {
                if (includeClassName !== className)
                    continue;
                let text = '';
                for (let req of requests) {
                    const reqName = options.methodNameMode == "operationId"
                        ? req.operationId
                        : req.name;
                    if (includeRequests) {
                        if (includeRequests.includes(reqName)) {
                            text += template_1.requestTemplate(reqName, req.requestSchema, options);
                            // generate ref definition model
                            let imports = utils_1.findDeepRefs(req.requestSchema.parsedParameters.imports, allModel, allEnum);
                            allImport = allImport.concat(imports);
                        }
                    }
                    else {
                        text += template_1.requestTemplate(reqName, req.requestSchema, options);
                        let imports = utils_1.findDeepRefs(req.requestSchema.parsedParameters.imports, allModel, allEnum);
                        allImport = allImport.concat(imports);
                    }
                }
                text = template_1.serviceTemplate(className + options.serviceNameSuffix, text);
                reqSource += text;
            }
        });
        allModel.forEach(item => {
            if (allImport.includes(item.name)) {
                const text = template_1.classTemplate(item.value.name, item.value.props, []);
                defSource += text;
            }
        });
        allEnum.forEach(item => {
            if (allImport.includes(item.name)) {
                const text = item.value
                    ? template_1.enumTemplate(item.value.name, item.value.enumProps, options.enumNamePrefix)
                    : item.content || '';
                defSource += text;
            }
        });
        apiSource += reqSource + defSource;
        writeFile(options.outputDir || '', options.fileName || '', format(apiSource));
    }
    else {
        try {
            Object.entries(requestCodegen_1.requestCodegen(swaggerSource.paths)).forEach(([className, requests]) => {
                let text = '';
                requests.forEach(req => {
                    const reqName = options.methodNameMode == "operationId"
                        ? req.operationId
                        : req.name;
                    text += template_1.requestTemplate(reqName, req.requestSchema, options);
                });
                text = template_1.serviceTemplate(className + options.serviceNameSuffix, text);
                apiSource += text;
            });
            const { models, enums } = definitionCodegen_1.definitionsCodeGen(swaggerSource.definitions);
            Object.values(models).forEach(item => {
                const text = template_1.classTemplate(item.value.name, item.value.props, []);
                apiSource += text;
            });
            Object.values(enums).forEach(item => {
                const text = item.value
                    ? template_1.enumTemplate(item.value.name, item.value.enumProps, options.enumNamePrefix)
                    : item.content || '';
                apiSource += text;
            });
            writeFile(options.outputDir || '', options.fileName || '', format(apiSource));
        }
        catch (error) {
            console.log('error', error);
        }
    }
    if (fs.existsSync('./cache_swagger.json')) {
        fs.unlinkSync('./cache_swagger.json');
    }
    console.timeEnd('finish');
}
exports.codegen = codegen;
function writeFile(fileDir, name, data) {
    if (!fs.existsSync(fileDir)) {
        fs.mkdirSync(fileDir);
    }
    const filename = path.join(fileDir, name);
    console.log('filename', filename);
    fs.writeFileSync(filename, data);
}
function format(text) {
    return prettier_1.default.format(text, {
        "printWidth": 120,
        "tabWidth": 2,
        "parser": "typescript",
        "trailingComma": "none",
        "jsxBracketSameLine": false,
        "semi": true,
        "singleQuote": true
    });
}
