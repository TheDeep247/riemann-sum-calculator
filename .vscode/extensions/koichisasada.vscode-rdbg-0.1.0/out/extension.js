"use strict";
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
exports.deactivate = exports.activate = void 0;
const child_process = require("child_process");
const fs = require("fs");
const path = require("path");
const net = require("net");
const vscode = require("vscode");
const vscode_1 = require("vscode");
let outputChannel;
let outputTerminals = new Map();
let last_exec_command;
let last_program;
const terminalName = 'Ruby Debug Terminal';
function workspace_folder() {
    if (vscode.workspace.workspaceFolders) {
        for (const ws of vscode.workspace.workspaceFolders) {
            return ws.uri.fsPath;
        }
    }
}
function custom_path(working_directory) {
    if (path.isAbsolute(working_directory)) {
        return working_directory;
    }
    else {
        const wspath = workspace_folder();
        if (wspath) {
            return path.join(wspath, working_directory);
        }
        else {
            return working_directory;
        }
    }
}
function pp(obj) {
    outputChannel.appendLine(JSON.stringify(obj));
}
function export_breakpoints(context) {
    if (vscode.workspace.getConfiguration("rdbg").get("saveBreakpoints")) {
        let wspath = workspace_folder();
        if (wspath) {
            var bp_lines = "";
            for (const bp of vscode.debug.breakpoints) {
                if (bp instanceof vscode.SourceBreakpoint && bp.enabled) {
                    // outputChannel.appendLine(JSON.stringify(bp));
                    const start_line = bp.location.range.start.line + 1;
                    const path = bp.location.uri.path;
                    bp_lines = bp_lines + "break " + path + ":" + start_line + "\n";
                }
            }
            const bp_path = path.join(wspath, ".rdbgrc.breakpoints");
            fs.writeFile(bp_path, bp_lines, e => { });
            outputChannel.appendLine("Written: " + bp_path);
        }
    }
}
function activate(context) {
    outputChannel = vscode.window.createOutputChannel('rdbg');
    context.subscriptions.push(vscode.debug.registerDebugConfigurationProvider('rdbg', new RdbgInitialConfigurationProvider()));
    context.subscriptions.push(vscode.debug.registerDebugAdapterDescriptorFactory('rdbg', new RdbgAdapterDescriptorFactory()));
    context.subscriptions.push(vscode.debug.registerDebugAdapterTrackerFactory('rdbg', new RdbgDebugAdapterTrackerFactory()));
    //
    context.subscriptions.push(vscode.debug.onDidChangeBreakpoints(e => {
        export_breakpoints(context);
    }));
    context.subscriptions.push(vscode.debug.onDidStartDebugSession((session) => __awaiter(this, void 0, void 0, function* () {
        const config = session.configuration;
        if (config.request !== 'launch' || config.useTerminal || config.noDebug)
            return;
        const args = {
            expression: ',eval $stdout.sync=true',
            context: 'repl'
        };
        try {
            yield session.customRequest('evaluate', args);
        }
        catch (err) {
            // We need to ignore the error because this request will be failed if the version of rdbg is older than 1.7. The `,command` API is introduced from version 1.7.
            pp(err);
        }
    })));
    const folders = vscode.workspace.workspaceFolders;
    if (folders != undefined && folders.length > 0) {
        const auto_attach_config_p = (c) => {
            if (c.type == "rdbg" && c.request == "attach" && c.autoAttach) {
                if (c.autoAttach == process.env.RUBY_DEBUG_AUTOATTACH) {
                    return true;
                }
                vscode.window.showErrorMessage(".vscode/rdbg_autoattach.json contains unexpected contents. Please check integrity.");
            }
            return false;
        };
        const json_path = path.join(folders[0].uri.fsPath, ".vscode/rdbg_autoattach.json");
        if (fs.existsSync(json_path)) {
            const c = JSON.parse(fs.readFileSync(json_path, 'utf8'));
            if (auto_attach_config_p(c)) {
                fs.unlinkSync(json_path);
                vscode.debug.startDebugging(folders[0], c);
                return;
            }
        }
    }
}
exports.activate = activate;
function deactivate() {
}
exports.deactivate = deactivate;
class RdbgDebugAdapterTrackerFactory {
    createDebugAdapterTracker(session) {
        const tracker = {
            onWillStartSession() {
                outputChannel.appendLine("[Start session]\n" + JSON.stringify(session));
            },
            onWillStopSession() {
                let outputTerminal = outputTerminals.get(session.id);
                if (outputTerminal) {
                    outputTerminal.show();
                    outputTerminals.delete(session.id);
                }
            },
            onError(e) {
                outputChannel.appendLine("[Error on session]\n" + e.name + ": " + e.message + "\ne: " + JSON.stringify(e));
            }
        };
        if (session.configuration.showProtocolLog) {
            tracker.onDidSendMessage = (message) => {
                outputChannel.appendLine("[DA->VSCode] " + JSON.stringify(message));
            };
            tracker.onWillReceiveMessage = (message) => {
                outputChannel.appendLine("[VSCode->DA] " + JSON.stringify(message));
            };
        }
        return tracker;
    }
}
class RdbgInitialConfigurationProvider {
    resolveDebugConfiguration(folder, config, token) {
        var _a;
        if (config.script || config.request == 'attach') {
            return config;
        }
        if (Object.keys(config).length > 0 && !config.script)
            return vscode.window.showInformationMessage("Cannot find a program to debug").then(_ => {
                return null;
            });
        // launch without configuration
        if (((_a = vscode.window.activeTextEditor) === null || _a === void 0 ? void 0 : _a.document.languageId) != 'ruby')
            return vscode.window.showInformationMessage("Select a ruby file to debug").then(_ => {
                return null;
            });
        return {
            type: 'rdbg',
            name: 'Launch',
            request: 'launch',
            script: '${file}',
            askParameters: true,
        };
    }
    ;
    provideDebugConfigurations(folder) {
        return [
            {
                type: 'rdbg',
                name: 'Debug current file with rdbg',
                request: 'launch',
                script: '${file}',
                args: [],
                askParameters: true,
            },
            {
                type: 'rdbg',
                name: 'Attach with rdbg',
                request: 'attach',
            }
        ];
    }
    ;
}
class StopDebugAdapter {
    constructor() {
        this.sendMessage = new vscode.EventEmitter();
        this.onDidSendMessage = this.sendMessage.event;
    }
    handleMessage(message) {
        const ev = {
            type: 'event',
            seq: 1,
            event: 'terminated',
        };
        this.sendMessage.fire(ev);
    }
    dispose() {
    }
}
const findRDBGTerminal = () => {
    let terminal;
    let currentTerminals = Array.from(outputTerminals.values());
    for (const t of vscode.window.terminals) {
        if (t.name === terminalName && !t.exitStatus && !currentTerminals.includes(t)) {
            terminal = t;
            break;
        }
    }
    return terminal;
};
class RdbgAdapterDescriptorFactory {
    constructor() {
        this.unixDomainRegex = /DEBUGGER:\sDebugger\scan\sattach\svia\s.+\((.+)\)/;
        this.colors = {
            red: 31,
            blue: 34
        };
        this.TCPRegex = /DEBUGGER:\sDebugger\scan\sattach\svia\s.+\((.+):(\d+)\)/;
    }
    createDebugAdapterDescriptor(session, executable) {
        // session.configuration.internalConsoleOptions = "neverOpen"; // TODO: doesn't affect...
        const c = session.configuration;
        if (c.request == 'attach') {
            return this.attach(session);
        }
        else {
            // launch
            if (c.useTerminal || c.noDebug) {
                return this.launch_on_terminal(session);
            }
            else {
                return this.launch_on_console(session);
            }
        }
    }
    show_error(msg) {
        outputChannel.appendLine("Error: " + msg);
        outputChannel.appendLine("Make sure to install rdbg command (`gem install debug`).\n" +
            "If you are using bundler, write `gem 'debug'` in your Gemfile.");
        outputChannel.show();
    }
    support_login(shell) {
        if (shell && (shell.endsWith("bash") || shell.endsWith("zsh") || shell.endsWith("fish"))) {
            return true;
        }
        else {
            return false;
        }
    }
    make_shell_command(cmd) {
        const shell = process.env.SHELL;
        if (this.support_login(shell)) {
            return shell + " -l -c '" + cmd + "'";
        }
        else {
            return cmd;
        }
    }
    get_sock_list(config) {
        return __awaiter(this, void 0, void 0, function* () {
            const rdbg = config.rdbgPath || "rdbg";
            const cmd = this.make_shell_command(rdbg + ' --util=list-socks');
            return new Promise((resolve, reject) => {
                child_process.exec(cmd, {
                    cwd: config.cwd ? custom_path(config.cwd) : workspace_folder(),
                    env: Object.assign(Object.assign({}, process.env), config.env)
                }, (err, stdout, stderr) => {
                    if (err || stderr) {
                        reject(err !== null && err !== void 0 ? err : stderr);
                    }
                    else {
                        let socks = [];
                        if (stdout.length > 0) {
                            for (const line of stdout.split("\n")) {
                                if (line.length > 0) {
                                    socks.push(line);
                                }
                            }
                        }
                        resolve(socks);
                    }
                });
            });
        });
    }
    parse_port(port) {
        var m;
        if (port.match(/^\d+$/)) {
            return ["localhost", parseInt(port), undefined];
        }
        else if ((m = port.match(/^(.+):(\d+)$/))) {
            return [m[1], parseInt(m[2]), undefined];
        }
        else {
            return [undefined, undefined, port];
        }
    }
    attach(session) {
        return __awaiter(this, void 0, void 0, function* () {
            const config = session.configuration;
            let port;
            let host;
            let sock_path;
            if (config.noDebug) {
                vscode.window.showErrorMessage("Can not attach \"Without debugging\".");
                return new vscode_1.DebugAdapterInlineImplementation(new StopDebugAdapter);
            }
            if (config.debugPort) {
                [host, port, sock_path] = this.parse_port(config.debugPort);
            }
            else {
                const list = yield this.get_sock_list(config);
                outputChannel.appendLine(JSON.stringify(list));
                switch (list.length) {
                    case 0:
                        vscode.window.showErrorMessage("Can not find attachable Ruby process.");
                        return new vscode_1.DebugAdapterInlineImplementation(new StopDebugAdapter);
                    case 1:
                        sock_path = list[0];
                        break;
                    default:
                        const sock = yield vscode.window.showQuickPick(list);
                        if (sock) {
                            sock_path = sock;
                        }
                        else {
                            return new vscode_1.DebugAdapterInlineImplementation(new StopDebugAdapter);
                        }
                }
            }
            if (sock_path) {
                return new vscode_1.DebugAdapterNamedPipeServer(sock_path);
            }
            else if (port) {
                return new vscode.DebugAdapterServer(port, host);
            }
            else {
                vscode.window.showErrorMessage("Unrechable.");
                return new vscode_1.DebugAdapterInlineImplementation(new StopDebugAdapter);
            }
        });
    }
    get_sock_path(config) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve) => {
                var _a, _b;
                const rdbg = config.rdbgPath || "rdbg";
                const command = this.make_shell_command(rdbg + " --util=gen-sockpath");
                const p = child_process.exec(command, {
                    cwd: config.cwd ? custom_path(config.cwd) : workspace_folder(),
                    env: Object.assign(Object.assign({}, process.env), config.env)
                });
                let path;
                p.on('error', e => {
                    this.show_error(e.message);
                    resolve(undefined);
                });
                p.on('exit', (code) => {
                    if (code != 0) {
                        this.show_error("exit code is " + code);
                        resolve(undefined);
                    }
                    else {
                        resolve(path);
                    }
                });
                (_a = p.stderr) === null || _a === void 0 ? void 0 : _a.on('data', err => {
                    outputChannel.appendLine(err);
                });
                (_b = p.stdout) === null || _b === void 0 ? void 0 : _b.on('data', out => {
                    path = out.trim();
                });
            });
        });
    }
    get_tcp_port_file(config) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve) => {
                var _a, _b;
                const rdbg = config.rdbgPath || "rdbg";
                const command = this.make_shell_command(rdbg + " --util=gen-portpath");
                const p = child_process.exec(command, {
                    cwd: config.cwd ? custom_path(config.cwd) : workspace_folder(),
                    env: Object.assign(Object.assign({}, process.env), config.env)
                });
                let path;
                p.on('error', e => {
                    resolve(undefined);
                });
                p.on('exit', (code) => {
                    resolve(path);
                });
                (_a = p.stderr) === null || _a === void 0 ? void 0 : _a.on('data', err => {
                    outputChannel.appendLine(err);
                });
                (_b = p.stdout) === null || _b === void 0 ? void 0 : _b.on('data', out => {
                    path = out.trim();
                });
            });
        });
    }
    get_version(config) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve) => {
                var _a, _b;
                const rdbg = config.rdbgPath || "rdbg";
                const command = this.make_shell_command(rdbg + " --version");
                const p = child_process.exec(command, {
                    cwd: config.cwd ? custom_path(config.cwd) : workspace_folder(),
                    env: Object.assign(Object.assign({}, process.env), config.env)
                });
                let version;
                p.on('error', e => {
                    this.show_error(e.message);
                    resolve(null);
                });
                p.on('exit', (code) => {
                    if (code != 0) {
                        this.show_error(command + ": exit code is " + code);
                        resolve(null);
                    }
                    else {
                        resolve(version);
                    }
                });
                (_a = p.stderr) === null || _a === void 0 ? void 0 : _a.on('data', err => {
                    outputChannel.appendLine(err);
                });
                (_b = p.stdout) === null || _b === void 0 ? void 0 : _b.on('data', out => {
                    version = out.trim();
                });
            });
        });
    }
    vernum(version) {
        const vers = /rdbg (\d+)\.(\d+)\.(\d+)/.exec(version);
        if (vers) {
            return Number(vers[1]) * 1000 * 1000 + Number(vers[2]) * 1000 + Number(vers[3]);
        }
        else {
            return 0;
        }
    }
    env_prefix(env) {
        if (env) {
            let prefix = "";
            if (process.platform === 'win32') {
                for (const key in env) {
                    prefix += '$Env:' + key + "='" + env[key] + "'; ";
                }
            }
            else {
                for (const key in env) {
                    prefix += key + "='" + env[key] + "' ";
                }
            }
            return prefix;
        }
        else {
            return "";
        }
    }
    sleep_ms(wait_ms) {
        return __awaiter(this, void 0, void 0, function* () {
            yield new Promise((resolve, reject) => {
                setTimeout(() => {
                    resolve(0);
                }, wait_ms); // ms
            });
        });
    }
    wait_file(path, wait_ms) {
        return __awaiter(this, void 0, void 0, function* () {
            let iterations = 50;
            if (wait_ms) {
                iterations = wait_ms / 100;
            }
            // check sock-path
            const start_time = Date.now();
            let i = 0;
            while (!fs.existsSync(path)) {
                i++;
                if (i > iterations) {
                    vscode.window.showErrorMessage("Couldn't start debug session (wait for " + (Date.now() - start_time) + " ms). Please install debug.gem.");
                    return false;
                }
                yield this.sleep_ms(100);
            }
            return true;
        });
    }
    getRandomPort() {
        const server = net.createServer();
        server.listen(0);
        const addr = server.address();
        const port = addr.port;
        server.close();
        return port;
    }
    launch_on_terminal(session) {
        return __awaiter(this, void 0, void 0, function* () {
            const config = session.configuration;
            const rdbg = config.rdbgPath || "rdbg";
            // outputChannel.appendLine(JSON.stringify(session));
            // setup debugPort
            let sock_path;
            let tcp_host;
            let tcp_port;
            let tcp_port_file;
            if (config.debugPort) {
                [tcp_host, tcp_port, sock_path] = this.parse_port(config.debugPort);
                if (process.platform === 'win32' && tcp_port === 0) {
                    tcp_port = this.getRandomPort();
                }
                else if (tcp_port != undefined) {
                    tcp_port_file = yield this.get_tcp_port_file(config);
                }
            }
            else if (process.platform === 'win32') {
                // default
                tcp_host = "localhost";
                tcp_port = this.getRandomPort();
            }
            else {
                sock_path = yield this.get_sock_path(config);
                if (!sock_path) {
                    return new vscode_1.DebugAdapterInlineImplementation(new StopDebugAdapter);
                }
                if (fs.existsSync(sock_path)) {
                    vscode.window.showErrorMessage("already exists: " + sock_path);
                    return new vscode_1.DebugAdapterInlineImplementation(new StopDebugAdapter);
                }
                outputChannel.appendLine("sock-path: <" + sock_path + ">");
            }
            // setup terminal
            let outputTerminal = findRDBGTerminal();
            if (!outputTerminal) {
                const shell = process.env.SHELL;
                const shell_args = this.support_login(shell) ? ['-l'] : undefined;
                outputTerminal = vscode.window.createTerminal({
                    name: terminalName,
                    shellPath: shell,
                    shellArgs: shell_args,
                    message: `Created by vscode-rdbg at ${new Date()}`,
                    iconPath: new vscode_1.ThemeIcon("ruby")
                });
            }
            outputTerminals.set(session.id, outputTerminal);
            let exec_command = '';
            try {
                exec_command = yield this.getExecCommands(config);
            }
            catch (error) {
                if (error instanceof InvalidExecCommandError) {
                    return new vscode_1.DebugAdapterInlineImplementation(new StopDebugAdapter);
                }
                throw error;
            }
            let cmdline = this.env_prefix(config.env);
            if (config.noDebug) {
                cmdline += exec_command;
            }
            else {
                let rdbg_args;
                if (tcp_host !== undefined && tcp_port !== undefined) {
                    rdbg_args = this.getTCPRdbgArgs(exec_command, tcp_host, tcp_port, tcp_port_file);
                }
                else {
                    rdbg_args = this.getUnixRdbgArgs(exec_command, sock_path);
                }
                cmdline += rdbg + ' ' + rdbg_args.join(' ');
            }
            if (outputTerminal) {
                outputTerminal.show(false);
                if (config.cwd) {
                    // Ensure we are in the requested working directory
                    const cd_command = "cd " + custom_path(config.cwd);
                    outputTerminal.sendText(cd_command);
                }
                outputTerminal.sendText(cmdline);
            }
            if (config.noDebug) {
                return new vscode_1.DebugAdapterInlineImplementation(new StopDebugAdapter);
            }
            // use NamedPipe
            if (sock_path) {
                if (yield this.wait_file(sock_path, config.waitLaunchTime)) {
                    return new vscode_1.DebugAdapterNamedPipeServer(sock_path);
                }
                else {
                    return new vscode_1.DebugAdapterInlineImplementation(new StopDebugAdapter);
                }
            }
            else if (tcp_port != undefined) {
                if (tcp_port_file) {
                    if (yield this.wait_file(tcp_port_file, config.waitLaunchTime)) {
                        const port_str = fs.readFileSync(tcp_port_file);
                        tcp_port = parseInt(port_str.toString());
                    }
                    else {
                        return new vscode_1.DebugAdapterInlineImplementation(new StopDebugAdapter);
                    }
                }
                else {
                    const wait_ms = config.waitLaunchTime ? config.waitLaunchTime : 5000 /* 5 sec */;
                    yield this.sleep_ms(wait_ms);
                }
                return new vscode.DebugAdapterServer(tcp_port, tcp_host);
            }
            // failed
            return new vscode_1.DebugAdapterInlineImplementation(new StopDebugAdapter);
        });
    }
    getExecCommands(config) {
        return __awaiter(this, void 0, void 0, function* () {
            const useBundlerFlag = (config.useBundler !== undefined) ? config.useBundler : vscode.workspace.getConfiguration("rdbg").get("useBundler");
            const useBundler = useBundlerFlag && fs.existsSync(workspace_folder() + '/Gemfile');
            const ruby_command = config.command ? config.command : (useBundler ? 'bundle exec ruby' : 'ruby');
            let exec_args = config.script + " " + (config.args ? config.args.join(' ') : '');
            let exec_command = ruby_command + ' ' + exec_args;
            if (config.askParameters) {
                if (last_exec_command && last_program === config.script) {
                    exec_command = last_exec_command;
                }
                exec_command = yield vscode.window.showInputBox({
                    "title": "Debug command line",
                    "value": exec_command
                });
            }
            if (exec_command === undefined || exec_command.length <= 0) {
                throw new InvalidExecCommandError();
            }
            // Save the history of command and script to use next time in `config.askParameters`.
            last_exec_command = exec_command;
            last_program = config.script;
            return exec_command;
        });
    }
    getTCPRdbgArgs(execCommand, host, port, port_path) {
        const rdbg_args = [];
        rdbg_args.push('--command', '--open', '--stop-at-load');
        rdbg_args.push("--host=" + host);
        let portArg = port.toString();
        if (port_path) {
            portArg += ":" + port_path;
        }
        rdbg_args.push("--port=" + portArg);
        rdbg_args.push('--');
        rdbg_args.push(...execCommand.trim().split(' '));
        return rdbg_args;
    }
    getUnixRdbgArgs(exec_command, sockPath) {
        const rdbg_args = [];
        rdbg_args.push('--command', '--open', '--stop-at-load');
        if (sockPath) {
            rdbg_args.push("--sock-path=" + sockPath);
        }
        rdbg_args.push('--');
        rdbg_args.push(...exec_command.trim().split(' '));
        return rdbg_args;
    }
    launch_on_console(session) {
        return __awaiter(this, void 0, void 0, function* () {
            const config = session.configuration;
            const rdbg = config.rdbgPath || "rdbg";
            const debugConsole = vscode.debug.activeDebugConsole;
            // outputChannel.appendLine(JSON.stringify(session));
            let exec_command = '';
            try {
                exec_command = yield this.getExecCommands(config);
            }
            catch (error) {
                if (error instanceof InvalidExecCommandError) {
                    return new vscode_1.DebugAdapterInlineImplementation(new StopDebugAdapter);
                }
                throw error;
            }
            const options = {
                env: Object.assign(Object.assign({}, process.env), config.env),
                cwd: custom_path(config.cwd || ''),
            };
            if (process.platform === 'win32')
                options.shell = 'powershell';
            let sock_path = undefined;
            let tcp_host = undefined;
            let tcp_port = undefined;
            if (config.debugPort) {
                [tcp_host, tcp_port, sock_path] = this.parse_port(config.debugPort);
            }
            else if (process.platform === 'win32') {
                // default
                tcp_host = "localhost";
                tcp_port = 0;
            }
            if (tcp_host !== undefined && tcp_port !== undefined) {
                const rdbg_args = this.getTCPRdbgArgs(exec_command, tcp_host, tcp_port);
                try {
                    [, tcp_port] = yield this.runDebuggeeWithTCP(debugConsole, rdbg, rdbg_args, options);
                }
                catch (error) {
                    vscode.window.showErrorMessage(error.message);
                    return new vscode_1.DebugAdapterInlineImplementation(new StopDebugAdapter);
                }
                return new vscode.DebugAdapterServer(tcp_port, tcp_host);
            }
            const rdbg_args = this.getUnixRdbgArgs(exec_command, sock_path);
            try {
                sock_path = yield this.runDebuggeeWithUnix(debugConsole, rdbg, rdbg_args, options);
            }
            catch (error) {
                vscode.window.showErrorMessage(error.message);
                return new vscode_1.DebugAdapterInlineImplementation(new StopDebugAdapter);
            }
            if (yield this.wait_file(sock_path, config.waitLaunchTime)) {
                return new vscode_1.DebugAdapterNamedPipeServer(sock_path);
            }
            // failed
            return new vscode_1.DebugAdapterInlineImplementation(new StopDebugAdapter);
        });
    }
    colorMessage(message, colorCode) {
        return `\u001b[${colorCode}m${message}\u001b[0m`;
    }
    runDebuggeeWithUnix(debugConsole, cmd, args, options) {
        return __awaiter(this, void 0, void 0, function* () {
            pp(`Running: ${cmd} ${args === null || args === void 0 ? void 0 : args.join(' ')}`);
            let connectionReady = false;
            let sockPath = '';
            let stderr = '';
            return new Promise((resolve, reject) => {
                const debugProcess = child_process.spawn(cmd, args, options);
                debugProcess.stderr.on('data', (chunk) => {
                    const msg = chunk.toString();
                    stderr += msg;
                    if (stderr.includes('Error')) {
                        reject(new Error(stderr));
                    }
                    if (stderr.includes('DEBUGGER: wait for debugger connection...')) {
                        connectionReady = true;
                    }
                    const found = stderr.match(this.unixDomainRegex);
                    if (found !== null && found.length === 2) {
                        sockPath = found[1];
                    }
                    debugConsole.append(this.colorMessage(msg, this.colors.red));
                    if (sockPath.length > 0 && connectionReady) {
                        resolve(sockPath);
                    }
                });
                debugProcess.stdout.on('data', (chunk) => {
                    debugConsole.append(this.colorMessage(chunk.toString(), this.colors.blue));
                });
                debugProcess.on('error', (err) => {
                    debugConsole.append(err.message);
                    reject(err);
                });
                debugProcess.on('exit', (code) => {
                    reject(new Error(`Couldn't start debug session. The debuggee process exited with code ${code}`));
                });
            });
        });
    }
    runDebuggeeWithTCP(debugConsole, cmd, args, options) {
        return __awaiter(this, void 0, void 0, function* () {
            pp(`Running: ${cmd} ${args === null || args === void 0 ? void 0 : args.join(' ')}`);
            let connectionReady = false;
            let host = '';
            let port = -1;
            let stderr = '';
            return new Promise((resolve, reject) => {
                const debugProcess = child_process.spawn(cmd, args, options);
                debugProcess.stderr.on('data', (chunk) => {
                    const msg = chunk.toString();
                    stderr += msg;
                    if (stderr.includes('Error')) {
                        reject(new Error(stderr));
                    }
                    if (stderr.includes('DEBUGGER: wait for debugger connection...')) {
                        connectionReady = true;
                    }
                    const found = stderr.match(this.TCPRegex);
                    if (found !== null && found.length === 3) {
                        host = found[1];
                        port = parseInt(found[2]);
                    }
                    debugConsole.append(this.colorMessage(msg, this.colors.red));
                    if (host.length > 0 && port !== -1 && connectionReady) {
                        resolve([host, port]);
                    }
                });
                debugProcess.stdout.on('data', (chunk) => {
                    debugConsole.append(this.colorMessage(chunk.toString(), this.colors.blue));
                });
                debugProcess.on('error', (err) => {
                    debugConsole.append(err.message);
                    reject(err);
                });
                debugProcess.on('exit', (code) => {
                    reject(new Error(`Couldn't start debug session. The debuggee process exited with code ${code}`));
                });
            });
        });
    }
}
class InvalidExecCommandError extends Error {
}
//# sourceMappingURL=extension.js.map