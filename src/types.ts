export type RouteDefaults = { [index: string]: string | number };

export type RouteRequirements = { [index: string]: string | number };

export type RouteParams = { [index: string]: any };

export type RoutesMap = { [index: string]: Route };

export interface QueryParamAddFunction {
    (prefix: string, params: any): void;
}

export interface Context {
    baseUrl: string;
    prefix?: string
    host?: string
    scheme?: string
}

export enum TokenType {
    Text = 'text',
    Variable = 'variable',
}

export type Token = string[];

export interface ParsedToken {
    type: TokenType
    prefix: string
    pattern: string
    name: string
}

export interface Route {
    tokens: Token[]
    defaults?: RouteDefaults
    requirements?: RouteRequirements
    hosttokens?: Token[]
    schemes?: string[]
    methods?: string[]
}
