import { SearchServiceTreeItem } from "./SearchServiceTreeItem";
import { SimpleSearchClient } from "./SimpleSearchClient";
import { SearchResourceListTreeItem } from "./SearchResourceListTreeItem";
import { getResourcesPath } from "./constants";
import { Uri } from "vscode";
import * as path from 'path';

export class IndexerListTreeItem extends SearchResourceListTreeItem {
    public static readonly contextValue: string = "azureSearchIndexerList";
    public static readonly itemContextValue: string = "azureSearchIndexer";

    public constructor(parent: SearchServiceTreeItem, searchClient: SimpleSearchClient) {
        super(parent,
            IndexerListTreeItem.contextValue,
            IndexerListTreeItem.itemContextValue,
            "Indexers",
            SimpleSearchClient.Indexers,
            "indexer",
            "azsindexer",
            searchClient);
    }

    public iconPath: { light: string | Uri; dark: string | Uri } = {
        light: path.join(getResourcesPath(), 'light', 'indexer.svg'),
        dark: path.join(getResourcesPath(), 'dark', 'indexer.svg')
    };
}
