import { registerOauth } from "./oauth.js";
import { registerUsers } from "./users.js";
import { registerSearch } from "./search.js";
import { registerPages } from "./pages.js";
import { registerBlocks } from "./blocks.js";
import { registerDatabases } from "./databases.js";
import { registerDataSources } from "./dataSources.js";
import { registerComments } from "./comments.js";
import { registerFileUploads } from "./fileUploads.js";
import { registerOps } from "./ops.js";
import { registerRequest } from "./request.js";
import { registerConfig } from "./config.js";
export function registerCommands(program, helpers) {
    registerOauth(program, helpers);
    registerUsers(program, helpers);
    registerSearch(program, helpers);
    registerPages(program, helpers);
    registerBlocks(program, helpers);
    registerDatabases(program, helpers);
    registerDataSources(program, helpers);
    registerComments(program, helpers);
    registerFileUploads(program, helpers);
    registerOps(program, helpers);
    registerRequest(program, helpers);
    registerConfig(program, helpers);
}
