'use strict';
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = void 0;
const vscode = require("vscode");
const child_process_1 = require("mz/child_process");
const vscode_languageclient_1 = require("vscode-languageclient");
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
function pullImage(image) {
    return __awaiter(this, void 0, void 0, function* () {
        var attempts = 0;
        while (attempts < 10) {
            try {
                yield vscode.window.withProgress({ title: "vscode_ruby_language_server", location: vscode.ProgressLocation.Window }, (progress) => __awaiter(this, void 0, void 0, function* () {
                    progress.report({ message: `Pulling ${image}` });
                    // console.log('before')
                    yield child_process_1.execFile("docker", ["pull", image]);
                    // console.error('after');
                    attempts = attempts + 10;
                }));
            }
            catch (err) {
                attempts = attempts + 1;
                // vscode.window.showErrorMessage(`${err.code}`);
                if (err.code == 1) { // Docker not yet running
                    // console.error('a');
                    vscode.window.showErrorMessage('Waiting for docker to start');
                    // console.error('b');
                    yield delay(10 * 1000);
                    // console.error('c');
                }
                else {
                    if (err.code == "ENOENT") {
                        const selected = yield vscode.window.showErrorMessage('Docker executable not found. Install Docker.', { modal: true }, 'Open settings');
                        if (selected === 'Open settings') {
                            yield vscode.commands.executeCommand('workbench.action.openWorkspaceSettings');
                        }
                    }
                    else {
                        vscode.window.showErrorMessage('Error updating docker image! - will try to use existing local one: ' + err.message);
                        console.error(err);
                    }
                }
            }
        }
    });
}
function activate(context) {
    return __awaiter(this, void 0, void 0, function* () {
        const conf = vscode.workspace.getConfiguration("ruby-language-server");
        let defaultImage = "kwerle/ruby_language_server";
        let command;
        let args;
        const image = conf["dockerImage"] || defaultImage;
        command = "docker";
        let logLevel = conf["logLevel"];
        args = ["run", "--rm", "-i", "-e", `LOG_LEVEL=${logLevel}`, "-v", `${vscode.workspace.rootPath}:/project`, "-w", "/project"];
        let additionalGems = conf["additionalGems"];
        if (additionalGems && additionalGems != "") {
            args.push("-e", `ADDITIONAL_GEMS=${additionalGems}`);
        }
        args.push(image);
        // console.log("HERE 1");
        pullImage(image);
        // console.log("HERE 2");
        const clientOptions = {
            documentSelector: ['ruby']
        };
        const executable = { command, args };
        // console.log("HERE 3");
        try {
            // Try to run a simple docker command
            yield child_process_1.execFile("docker", ["ps"]);
            // console.log("HERE 3.1");
        }
        catch (error) {
            // If it fails we assume it's starting up - give it time
            // console.log("HERE 3.2");
            yield delay(20 * 1000);
            // console.log("HERE 3.3");
        }
        const disposable = new vscode_languageclient_1.LanguageClient('Ruby Language Server', executable, clientOptions).start();
        // console.log("HERE 4");
        context.subscriptions.push(disposable);
    });
}
exports.activate = activate;
//# sourceMappingURL=extension.js.map