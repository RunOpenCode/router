import {
    Route,
    RouteParams,
    RoutesMap,
} from './types';

export interface RouterInterface {

    getRoutes(): RoutesMap;

    getBaseUrl(): string;

    getScheme(): string;

    getHost(): string;

    getRoute(name: string): Route;

    generate(name: string, params: RouteParams, absolute: boolean): string;

}
