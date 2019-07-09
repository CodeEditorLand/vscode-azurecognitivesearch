import Axios, { AxiosResponse, AxiosRequestConfig } from "axios";
import { appendExtensionUserAgent } from "vscode-azureextensionui";

export class SimpleSearchClient {
    private static readonly API_VERSION = "2019-05-06";
    private readonly userAgent: string;

    public constructor(
        public readonly serviceName: string,
        private readonly apikey: string,
        private readonly cloudSuffix?: string | undefined) {
        this.userAgent = appendExtensionUserAgent();
    }

    public async listIndexes() : Promise<Index[]> {
        let r = await this.httpGet<CollectionResponse<Index>>("indexes", "$select=name,fields");
        return r.data.value;
    }

    public async listDataSources(): Promise<string[]> {
        let r = await this.httpGet<CollectionResponse<NamedItem>>("datasources", "$select=name");
        return r.data.value.map(i => i.name);
    }

    public async listIndexers(): Promise<string[]> {
        let r = await this.httpGet<CollectionResponse<NamedItem>>("indexers", "$select=name");
        return r.data.value.map(i => i.name);
    }

    public async getResource(resource: string, name: string): Promise<{ content: any, etag: string }> {
        let r = await this.httpGet<any>(`${resource}/${name}`);
        return { content: r.data, etag: r.headers["etag"] };
    }

    public updateResource(resource: string, name: string, content: any, etag?: string): Promise<void> {
        return this.httpPut(`${resource}/${name}`, content, etag);
    }

    public async query(indexName: string, query: string, raw: boolean = false) : Promise<QueryResponse> {
        let r = await this.httpGet(`indexes/${indexName}/docs`, query);
        if (!raw) {
            this.fixupQueryResponse(r.data);
        }
        return r.data;
    }

    public async queryNext(nextLink: string) : Promise<QueryResponse> {
        let r = await this.httpGetUrl(nextLink);
        this.fixupQueryResponse(r.data);
        return r.data;
    }

    public async lookup(indexName: string, key: string) : Promise<any> {
        const encodedKey = encodeURIComponent(key);
        let r = await this.httpGet(`indexes/${indexName}/docs/${encodedKey}`);
        return r.data;
    }

    public async uploadDocument(indexName: string, doc: any, createNew: boolean) : Promise<void> {
        const shallowCopy = { ...doc };
        shallowCopy["@search.action"] = createNew ? "mergeOrUpload" : "merge";
        const batch = { value: [shallowCopy] };

        await this.indexBatch(indexName, batch);
    }

    public async deleteDocument(indexName: string, keyName: string, key: any) : Promise<void> {
        const deletion: any = {};
        deletion["@search.action"] = "delete";
        deletion[keyName] = key;
        const batch = { value: [ deletion ] };

        await this.indexBatch(indexName, batch);
    }

    private async indexBatch(indexName: string, batch: { value: any }) : Promise<void> {
        let batchResponse: CollectionResponse<BatchResponseEntry>;

        try {
            const r = await this.httpPost<CollectionResponse<BatchResponseEntry>>(`indexes/${indexName}/docs/index`, batch);
            batchResponse = r.data;
        }
        catch (error) {
            throw new Error(`Failed to process document: ${this.extractErrorMessage(error)}`);
        }

        if (batchResponse.value.length !== 1) {
            throw new Error("Unexpected response from service while attempting to process document");
        }

        if (!batchResponse.value[0].status) {
            throw new Error(`Failed to process document: ${batchResponse.value[0].errorMessage}`);
        }
    }

    private extractErrorMessage(error: any): string | undefined {
        if (error.response && error.response.data && error.response.data.error && error.response.data.error.message) {
            return error.response.data.error.message;
        }

        return `Error: ${error.message || error}`;
    }

    private fixupQueryResponse(response: any) {
        response.nextLink = response["@odata.nextLink"];
        response.nextPageParameteres = response["@search.nextPageParameters"];
    }

    private httpGet<T = any, R = AxiosResponse<T>>(path: string, queryString: string = "") : Promise<R> {
        return this.httpGetUrl(this.makeUrl(path, queryString));
    }

    private async httpGetUrl<T = any, R = AxiosResponse<T>>(url: string) : Promise<R> {
        try {
            return await Axios.get<T, R>(url, this.makeRequestConfig());
        }
        catch (error) {
            throw new Error(this.extractErrorMessage(error));
        }
    }

    private async httpPost<T = any, R = AxiosResponse<T>>(path: string, data: any) : Promise<R> {
        try {
            return await Axios.post<T, R>(this.makeUrl(path), data, this.makeRequestConfig());
        }
        catch (error) {
            throw new Error(this.extractErrorMessage(error));
        }
    }

    private async httpPut<T = any, R = AxiosResponse<T>>(path: string, data: any, etag?: string) : Promise<R> {
        try {
            const config = this.makeRequestConfig();
            if (etag) {
                config.headers["if-match"] = etag;
            }
            return await Axios.put<T, R>(this.makeUrl(path), data, config);
        }
        catch (error) {
            throw new Error(this.extractErrorMessage(error));
        }
    }

    private makeUrl(path: string, options: string = "") : string {
        let suffix: string = this.cloudSuffix || "search.windows.net";
        if (options !== "" && options[0] !== "&") {
            options = "&" + options;
        }
        return `https://${this.serviceName}.${suffix}/${path}?api-version=${SimpleSearchClient.API_VERSION}${options}`;
    }

    private makeRequestConfig(): AxiosRequestConfig {
        return { headers: { "api-key": this.apikey, "User-Agent": this.userAgent } };
    }
}

interface CollectionResponse<T> {
    value: T[];
}

interface NamedItem {
    name: string;
}

interface BatchResponseEntry {
    key: any;
    status: boolean;
    errorMessage: string;
    statusCode: number;
}

export interface QueryResponse {
    value: any[];
    nextLink?: string | undefined;
}

export interface Index {
    name: string;
    fields: Field[];
}

export interface Field {
    name: string;
    key: boolean;    
}
