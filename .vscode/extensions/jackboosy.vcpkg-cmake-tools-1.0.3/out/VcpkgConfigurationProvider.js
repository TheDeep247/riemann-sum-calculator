"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vscode_1 = require("vscode");
class VcpkgConfigurationProvider {
    constructor(context) {
        this.context = context;
        this.disposables = [];
        this.didChangeConfigurationEmitter = new vscode_1.EventEmitter();
        this.onDidChangeConfiguration = this
            .didChangeConfigurationEmitter.event;
        this.disposables.push(vscode_1.workspace.onDidChangeConfiguration((e) => {
            if (e.affectsConfiguration("cmake.cpptools")) {
                this.updateClients();
            }
        }));
    }
}
//# sourceMappingURL=VcpkgConfigurationProvider.js.map