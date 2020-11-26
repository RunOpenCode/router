import { RouterInterface } from './router-interface';
import {
    Context,
    ParsedToken,
    QueryParamAddFunction,
    Route,
    RouteParams,
    RoutesMap,
    Token,
    TokenType,
}                          from './types';

export class Router implements RouterInterface {

    private readonly _context: Context;

    private readonly _routes: RoutesMap;

    public constructor(
        routes: RoutesMap = {},
        context: Partial<Context> = null,
    ) {
        this._context = {
            ...{
                baseUrl: '',
                prefix:  '',
                host:    '',
                scheme:  '',
            },
            ...(context || Router.getWindowContext()),
        };
        this._routes  = Object.freeze(routes);
    }

    public getRoutes(): RoutesMap {
        return this._routes;
    }

    public getBaseUrl(): string {
        return this._context.baseUrl;
    }

    public getScheme(): string {
        return this._context.scheme.toLowerCase();
    }

    public getHost(): string {
        return this._context.host;
    }

    public getRoute(name: string): Route {
        const prefixedName: string = this._context.prefix + name;

        if (prefixedName in this._routes) {
            return this._routes[prefixedName];

        }
        if (name in this._routes) {
            return this._routes[name];
        }

        throw new Error(`The route "${name}" does not exist.`);
    }

    public generate(name: string, params: RouteParams = {}, absolute: boolean = true): string {
        let route: Route              = this.getRoute(name);
        let unusedParams: RouteParams = { ...params };
        let url: string               = '';
        let isOptional: boolean       = true;
        let host: string              = '';

        route.tokens.forEach((rawToken: Token) => {
            let token: ParsedToken = Router.parseToken(rawToken);

            if (TokenType.Text === token.type) {
                url        = token.pattern + url;
                isOptional = false;

                return;
            }

            if (TokenType.Variable === token.type) {
                let hasDefault: boolean = route.defaults && (token.name in route.defaults);
                if (false === isOptional
                    || !hasDefault
                    // eslint-disable-next-line eqeqeq
                    || ((token.name in params) && params[token.name] != route.defaults[token.name])
                ) {
                    let value: any;

                    if (token.name in params) {
                        value = params[token.name];
                        delete unusedParams[token.name];

                    } else if (hasDefault) {
                        value = route.defaults[token.name];

                    } else if (isOptional) {
                        return;

                    } else {
                        throw new Error(`The route "${name}" requires the parameter "${token.name}".`);
                    }

                    let isEmpty: boolean = true === value || false === value || '' === value;

                    if (!isEmpty || !isOptional) {
                        let encodedValue: string = encodeURIComponent(value).replace(/%2F/g, '/');

                        if ('null' === encodedValue && null === value) {
                            encodedValue = '';
                        }

                        url = token.prefix + encodedValue + url;
                    }

                    isOptional = false;

                } else if (hasDefault && (token.name in unusedParams)) {
                    delete unusedParams[token.name];
                }

            }
        });

        if (url === '') {
            url = '/';
        }

        if (Array.isArray(route.hosttokens)) {
            route.hosttokens.forEach((rawToken: Token) => {
                let value: string | number;

                let token: ParsedToken = Router.parseToken(rawToken);

                if (TokenType.Text === token.type) {
                    host = token.pattern + host;
                    return;
                }

                if (TokenType.Variable === token.type) {
                    if (token.name in params) {
                        value = params[token.name];
                        delete unusedParams[token.name];

                    } else if (route.defaults && (token.name in route.defaults)) {
                        value = route.defaults[token.name];
                    }

                    host = token.prefix + value + host;
                }
            });
        }

        url = this.getBaseUrl() + url;

        if (route.requirements && ('_scheme' in route.requirements) && this.getScheme() !== route.requirements._scheme) {
            url = `${route.requirements._scheme}://${host || this.getHost()}${url}`;
        } else if ('undefined' !== typeof route.schemes
            && 'undefined' !== typeof route.schemes[0]
            && this.getScheme() !== route.schemes[0]
        ) {
            url = `${route.schemes[0]}://${host || this.getHost()}${url}`;
        } else if (host && this.getHost() !== host) {
            url = `${this.getScheme()}://${host}${url}`;
        } else if (absolute === true) {
            url = `${this.getScheme()}://${this.getHost()}${url}`;
        }

        if (Object.keys(unusedParams).length > 0) {
            let queryParams: { [key: string]: any }    = [];
            let add: (key: string, value: any) => void = (key: string, value: any): void => {
                let sanitizedValue: any = (typeof value === 'function') ? value() : value;
                sanitizedValue          = (null === sanitizedValue) ? '' : value;
                queryParams.push(`${encodeURIComponent(key)}=${encodeURIComponent(sanitizedValue)}`);
            };

            Object.keys(unusedParams).forEach((prefix: string): void => {
                this.buildQueryParams(prefix, unusedParams[prefix], add);
            });

            url = `${url}?${queryParams.join('&').replace(/%20/g, '+')}`;
        }

        return url;
    }

    private buildQueryParams(prefix: string, params: any[] | object | string, add: QueryParamAddFunction): void {
        let rbracket: RegExp = new RegExp(/\[\]$/);

        if (params instanceof Array) {
            params.forEach((val: string, i: number) => {
                if (rbracket.test(prefix)) {
                    add(prefix, val);
                } else {
                    this.buildQueryParams(`${prefix}[${typeof val === 'object' ? i : ''}]`, val, add);
                }
            });

        } else if (typeof params === 'object') {
            // eslint-disable-next-line guard-for-in,no-restricted-syntax
            for (let name in params) {
                this.buildQueryParams(`${prefix}[${name}]`, params[name], add);
            }

        } else {
            add(prefix, params);
        }
    }

    private static parseToken(token: Token): ParsedToken {
        let type: TokenType;
        let prefix: string;
        let pattern: string;
        let name: string;

        switch (token[0]) {
            case TokenType.Text:
                // eslint-disable-next-line @typescript-eslint/typedef
                [type, pattern] = token;
                break;

            case TokenType.Variable:
                // eslint-disable-next-line @typescript-eslint/typedef
                [type, prefix, pattern, name] = token;
                break;

            default:
                throw new Error(`The token type "${type}" is not supported.`);
        }

        return {
            type:    type,
            prefix:  prefix,
            pattern: pattern,
            name:    name,
        };
    }

    private static getWindowContext(): Partial<Context> {
        let url: URL = new URL(window.location.href.replace(/\/$/g, ''));

        return {
            host:   url.host,
            prefix: url.pathname,
            scheme: url.protocol.replace(/:$/g, ''),
        };
    }

}
