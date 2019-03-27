import { IDefinitionProperties } from "../saggerInterfaces";
import { IClassDef } from "../baseInterfaces";
/**
 * 生成类定义
 * @param className class名称
 * @param properties 属性
 * @param isGenericsType 是否是泛型接口
 */
export declare function createDefinitionClass(className: string, properties: IDefinitionProperties): {
    enums: {
        name: string;
        text: string;
    }[];
    model: IClassDef;
};
