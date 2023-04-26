"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConfigurationManager = void 0;
const fs = require("fs");
const vscode = require("vscode");
const vscode_1 = require("vscode");
class ConfigurationManager {
    constructor(context) {
        this.disposables = [];
        this._enableVcpkgConfig = 'general.enable';
        this._vcpkgPathConfig = 'general.vcpkgPath';
        this._useManifestConfig = 'general.useManifest';
        this._installDependenciesConfig = 'general.installDependencies';
        this._autoLinkConfig = 'general.autolink';
        this._installDirectoryConfig = 'general.installDirectory';
        this._additionalOptionsConfig = 'target.additionalOptions';
        this._useStaticLibConfig = 'target.useStaticLib';
        this._vcpkgUseDynamicCRTConfig = 'target.useDynamicCRT';
        this._targetTripletConfig = 'target.defaultTriplet';
        this._hostTripletConfig = 'target.hostTriplet';
        this._cmakeOptionConfig = 'configureArgs';
        this._configConfigSettingConfig = 'configureSettings';
        this._vcpkgManifestModeConfig = 'VCPKG_MANIFEST_MODE';
        this._vcpkgTargetTripletConfig = 'VCPKG_TARGET_TRIPLET';
        this._vcpkgInstallOptionsConfig = 'VCPKG_INSTALL_OPTIONS';
        this._vcpkgCRTLinkageConfig = 'VCPKG_CRT_LINKAGE';
        this._cmakeOptionPrefix = '-D';
        this._cmakeOptionEanble = '=ON';
        this._cmakeOptionDisable = '=OFF';
        this._context = context;
    }
    logInfo(content) {
        console.log("[vcpkg tools] " + content);
    }
    logErr(content) {
        console.error("[vcpkg tools] " + content);
    }
    getArch() {
        this.logInfo('process.platform: ' + process.platform);
        this.logInfo('os.arch: ' + process.arch);
        if (process.platform === "win32") {
            if (process.arch === 'x64') {
                return "x64-windows";
            }
            else if (process.arch === 'x86') {
                return "x86-windows";
            }
            else if (process.arch.toLowerCase() === 'arm') {
                return "arm-windows";
            }
            else if (process.arch.toLowerCase() === 'arm64') {
                return "arm64-windows";
            }
        }
        else if (process.platform === "darwin") {
            if (process.arch.toLowerCase() === 'arm64') {
                return "arm64-osx";
            }
            else {
                return "x64-osx";
            }
        }
        else if (process.platform === "linux") {
            return "x64-linux";
        }
    }
    generateVcpkgFullPath(path) {
        if (process.platform === "win32") {
            return path + '/vcpkg.exe';
        }
        else {
            return path + '/vcpkg';
        }
    }
    isVcpkgEnabled() {
        return vscode_1.workspace.getConfiguration('vcpkg').get(this._enableVcpkgConfig) === undefined ?
            false : vscode_1.workspace.getConfiguration('vcpkg').get(this._enableVcpkgConfig);
    }
    isVcpkgExistInPath(path) {
        return fs.existsSync(this.generateVcpkgFullPath(path));
    }
    async updateCMakeSetting(subSetting, value, userScope = false) {
        await vscode_1.workspace.getConfiguration('cmake').update(subSetting, value, userScope);
    }
    async updateVcpkgSetting(subSetting, value, userScope = false) {
        await vscode_1.workspace.getConfiguration('vcpkg').update(subSetting, value, userScope);
    }
    getAndCleanCMakeOptions(condition) {
        let cmakeConfigs = vscode_1.workspace.getConfiguration('cmake').get(this._cmakeOptionConfig);
        this.logInfo('cmake options: ' + cmakeConfigs?.toString() + ' condition: ' + condition);
        let newConfigs = new Array;
        if (cmakeConfigs !== undefined) {
            for (let curr in cmakeConfigs) {
                //this.logInfo('current cmake option: ' + cmakeConfigs[curr].toString() + ' index: ' + curr);
                let matched = cmakeConfigs[curr].toString().match(condition);
                //this.logInfo('matched: ' + matched);
                if (matched === null) {
                    newConfigs.push(cmakeConfigs[curr]);
                }
            }
        }
        return newConfigs;
    }
    getCleanVcpkgToolchian() {
        let currentSettings = vscode_1.workspace.getConfiguration('cmake').get(this._configConfigSettingConfig);
        let newSettings = new Object;
        for (let curr in currentSettings) {
            //this.logInfo("curr:" + curr);
            let matched = curr.match('CMAKE_TOOLCHAIN_FILE');
            //this.logInfo("matched:" + matched);
            if (matched !== null) {
                continue;
            }
            matched = curr.match('VCPKG_TARGET_TRIPLET');
            if (matched !== null) {
                continue;
            }
            newSettings[curr] = currentSettings[curr];
        }
        return newSettings;
    }
    isStaticLib(triplet) {
        return triplet.endsWith('-static');
    }
    async cleanupVcpkgRelatedCMakeOptions() {
        this.logInfo('clean up vcpkg-related cmake configs.');
        let cleanOptions = this.getAndCleanCMakeOptions(this._cmakeOptionPrefix + this._vcpkgManifestModeConfig);
        this.updateCMakeSetting(this._cmakeOptionConfig, cleanOptions);
        cleanOptions = this.getAndCleanCMakeOptions(this._cmakeOptionPrefix + this._vcpkgInstallOptionsConfig);
        this.updateCMakeSetting(this._cmakeOptionConfig, cleanOptions);
        cleanOptions = this.getAndCleanCMakeOptions(this._cmakeOptionPrefix + this._vcpkgTargetTripletConfig);
        this.updateCMakeSetting(this._cmakeOptionConfig, cleanOptions);
    }
    async addVcpkgToolchain(vcpkgRoot) {
        let cleanConfig = this.getCleanVcpkgToolchian();
        cleanConfig['CMAKE_TOOLCHAIN_FILE'] = vcpkgRoot + '/scripts/buildsystems/vcpkg.cmake';
        this.updateCMakeSetting(this._configConfigSettingConfig, cleanConfig);
    }
    async updateCurrentTripletSetting() {
        let isStatic = vscode_1.workspace.getConfiguration('vcpkg').get(this._useStaticLibConfig);
        let currTriplet = vscode_1.workspace.getConfiguration('vcpkg').get(this._targetTripletConfig);
        if (currTriplet === undefined) {
            this.logErr('Couldn\'t get current target triplet!');
            vscode.window.showInformationMessage('Vcpkg extension has problem! Please report it to github then disable and enable vcpkg extension.');
            return;
        }
        this.logInfo('current target triplet is: ' + currTriplet);
        if (isStatic) {
            if (!this.isStaticLib(currTriplet)) {
                currTriplet += '-static';
            }
        }
        else {
            if (this.isStaticLib(currTriplet)) {
                currTriplet = currTriplet.substring(0, currTriplet.length - '-static'.length);
            }
        }
        let cmakeTargetTripletSetting = this._cmakeOptionPrefix + this._vcpkgTargetTripletConfig + '=' + currTriplet;
        this.logInfo('set target triplet to:' + cmakeTargetTripletSetting);
        this.updateVcpkgSetting(this._targetTripletConfig, currTriplet);
        let newConfigs = this.getAndCleanCMakeOptions(this._cmakeOptionPrefix + this._vcpkgTargetTripletConfig);
        newConfigs.push(cmakeTargetTripletSetting);
        this.updateCMakeSetting(this._cmakeOptionConfig, newConfigs);
    }
    async updateCurrentCRTSetting() {
        let isUseDynamic = vscode_1.workspace.getConfiguration('vcpkg').get(this._vcpkgUseDynamicCRTConfig);
        this.updateVcpkgSetting(this._useManifestConfig, true);
        let newConfigs = this.getAndCleanCMakeOptions(this._cmakeOptionPrefix + this._vcpkgCRTLinkageConfig);
        newConfigs.push(this._cmakeOptionPrefix + this._vcpkgCRTLinkageConfig + isUseDynamic ? this._cmakeOptionEanble : this._cmakeOptionDisable);
        this.logInfo('cmake options: ' + newConfigs.toString());
        this.updateCMakeSetting(this._cmakeOptionPrefix, newConfigs);
    }
    async initCMakeSettings(vcpkgPath) {
        this.updateVcpkgSetting(this._vcpkgPathConfig, vcpkgPath, true);
        let currArch = this.getArch();
        this.logInfo('current arch is: ' + currArch);
        this.updateVcpkgSetting(this._enableVcpkgConfig, true);
        this.updateVcpkgSetting(this._hostTripletConfig, currArch);
        this.logInfo('update host triplet to: ' + currArch);
        this.updateVcpkgSetting(this._targetTripletConfig, currArch);
        this.logInfo('update target triplet to: ' + currArch);
        this.updateVcpkgSetting(this._useStaticLibConfig, false);
        this.logInfo('update use static lib to: ' + false);
        this.updateCurrentTripletSetting();
        this.addVcpkgToolchain(vcpkgPath);
        // disable manifest mode by default
        this.disableManifest();
    }
    async enableVcpkg() {
        if (this.isVcpkgEnabled()) {
            vscode.window.showInformationMessage('Vcpkg is already enabled.');
            return;
        }
        vscode.window.showInformationMessage('Enabling vcpkg...');
        // cleanup old vcpkg-related cmake configs
        this.cleanupVcpkgRelatedCMakeOptions();
        let oldPath = vscode_1.workspace.getConfiguration('vcpkg').get(this._vcpkgPathConfig);
        if (oldPath && this.isVcpkgExistInPath(oldPath)) {
            this.initCMakeSettings(oldPath);
            this.logInfo('vcpkg already set to ' + oldPath + ' , enabled plugin.');
            vscode.window.showInformationMessage('vcpkg enabled.');
            return;
        }
        let vcpkgRoot = "";
        if (process.env['VCPKG_ROOT']) {
            vcpkgRoot = process.env['VCPKG_ROOT'];
            if (this.isVcpkgExistInPath(vcpkgRoot)) {
                vscode.window.showInformationMessage('vcpkg enabled.');
                this.initCMakeSettings(vcpkgRoot);
                this.logInfo('update target/host triplet to ' + vscode_1.workspace.getConfiguration('vcpkg').get(this._hostTripletConfig));
                this.logInfo('detect env VCPKG_ROOT: ' + vcpkgRoot + ' , enabled plugin.');
                return;
            }
            else {
                this.logErr('invalid env VCPKG_ROOT: ' + vcpkgRoot + ' , plugin will not be enabled.');
                vscode.window.showErrorMessage('Invalid vcpkg path, vcpkg will not be enabled, pleaes check envornment variable VCPKG_ROOT.');
                return;
            }
        }
        else {
            let options = {
                canSelectFiles: false,
                canSelectFolders: true,
                canSelectMany: false,
                openLabel: 'Select vcpkg root path'
            };
            vscode.window.showOpenDialog(options).then(result => {
                if (result === undefined) {
                    this.logErr('invalid vcpkg path, plugin will not be enabled.');
                    vscode.window.showErrorMessage('Invalid vcpkg path, vcpkg will not be enabled.');
                    return;
                }
                let uri = result[0].path.toString();
                this.logInfo("select: " + uri);
                if (process.platform === "win32") {
                    vcpkgRoot = uri.substring(1, uri.length);
                }
                else {
                    vcpkgRoot = uri;
                }
                if (this.isVcpkgExistInPath(vcpkgRoot)) {
                    vscode.window.showInformationMessage('vcpkg enabled.');
                    this.initCMakeSettings(vcpkgRoot);
                    this.logInfo('update target/host triplet to ' + vscode_1.workspace.getConfiguration('vcpkg').get(this._hostTripletConfig));
                    this.logInfo('detect select valid vcpkg path: ' + vcpkgRoot + ' , enabled plugin.');
                    return;
                }
                else {
                    this.logErr('invalid vcpkg path: ' + vcpkgRoot + ' , plugin will not be enabled.');
                    vscode.window.showErrorMessage('Invalid vcpkg path, vcpkg will not be enabled.');
                    return;
                }
            });
        }
    }
    async disableVcpkg() {
        if (!this.isVcpkgEnabled()) {
            vscode.window.showInformationMessage('Vcpkg is already disabled.');
            return;
        }
        vscode.window.showInformationMessage('Disable vcpkg...');
        this.updateVcpkgSetting(this._enableVcpkgConfig, false);
        // clean vcpkg options
        this.cleanupVcpkgRelatedCMakeOptions();
        // clean toolchain setting
        this.updateCMakeSetting(this._configConfigSettingConfig, this.getCleanVcpkgToolchian());
        this.logInfo('Disabled vcpkg plugin.');
    }
    async enableManifest() {
        vscode.window.showInformationMessage('Manifest mode enabled.');
        this.updateVcpkgSetting(this._useManifestConfig, true);
        let newConfigs = this.getAndCleanCMakeOptions(this._cmakeOptionPrefix + this._vcpkgManifestModeConfig);
        newConfigs.push(this._cmakeOptionPrefix + this._vcpkgManifestModeConfig + this._cmakeOptionEanble);
        this.logInfo('cmake options: ' + newConfigs.toString());
        this.updateCMakeSetting(this._cmakeOptionConfig, newConfigs);
    }
    async disableManifest() {
        vscode.window.showInformationMessage('Manifest mode disabled.');
        this.updateVcpkgSetting(this._useManifestConfig, false);
        let newConfigs = this.getAndCleanCMakeOptions(this._cmakeOptionPrefix + this._vcpkgManifestModeConfig);
        newConfigs.push(this._cmakeOptionPrefix + this._vcpkgManifestModeConfig + this._cmakeOptionDisable);
        this.logInfo('cmake options: ' + newConfigs.toString());
        this.updateCMakeSetting(this._cmakeOptionConfig, newConfigs);
    }
    async getCurrentTriplet() {
        vscode.window.showInformationMessage('Current triplet is: ' + vscode_1.workspace.getConfiguration('vcpkg').get(this._targetTripletConfig));
    }
    async getCurrentHostTriplet() {
        vscode.window.showInformationMessage('Current host triplet is: ' + vscode_1.workspace.getConfiguration('vcpkg').get(this._hostTripletConfig));
    }
    async useLibType(staticLib) {
        this.updateVcpkgSetting(this._useStaticLibConfig, staticLib);
        this.updateCurrentTripletSetting();
        this.logInfo('Set to ' + staticLib ? 'static' : 'dynamic' + ' triplet');
        vscode.window.showInformationMessage('Now use ' + staticLib ? 'static' : 'dynamic' + ' library / triplet');
    }
    async useCRTType(dynamicCRT) {
        this.updateVcpkgSetting(this._vcpkgUseDynamicCRTConfig, dynamicCRT);
        this.updateCurrentCRTSetting();
        this.logInfo('Set to ' + dynamicCRT ? 'dynamic' : 'static' + ' triplet');
        vscode.window.showInformationMessage('Now use ' + dynamicCRT ? 'dynamic' : 'static' + ' CRT linkage');
    }
    async onConfigurationChanged(event) {
        this.logInfo('detect configuration changed.');
        if (event.affectsConfiguration('vcpkg.' + this._enableVcpkgConfig)) {
            this.logInfo('detect vcpkg enable configuration changed.');
            if (vscode_1.workspace.getConfiguration('vcpkg').get(this._enableVcpkgConfig)) {
                this.enableVcpkg();
            }
            else {
                this.disableVcpkg();
            }
        }
        else if (event.affectsConfiguration('vcpkg.' + this._vcpkgPathConfig)) {
            this.logInfo('detect vcpkg path configuration changed.');
            this.disableVcpkg();
            this.enableVcpkg();
        }
        else if (event.affectsConfiguration('vcpkg.' + this._useManifestConfig)) {
            this.logInfo('detect vcpkg manifest configuration changed.');
            if (vscode_1.workspace.getConfiguration('vcpkg').get(this._useManifestConfig)) {
                this.enableManifest();
            }
            else {
                this.disableManifest();
            }
        }
        else if (event.affectsConfiguration('vcpkg.' + this._installDependenciesConfig)) {
        }
        else if (event.affectsConfiguration('vcpkg.' + this._autoLinkConfig)) {
        }
        else if (event.affectsConfiguration('vcpkg.' + this._installDirectoryConfig)) {
        }
        else if (event.affectsConfiguration('vcpkg.' + this._additionalOptionsConfig)) {
            this.logInfo('detect vcpkg install option configuration changed.');
            let extraOptCfgs = vscode_1.workspace.getConfiguration('vcpkg').get(this._additionalOptionsConfig);
            if (extraOptCfgs !== undefined && extraOptCfgs.length) {
                let extraOptions = this._cmakeOptionPrefix + this._vcpkgInstallOptionsConfig + '="';
                for (let curr in extraOptCfgs) {
                    extraOptions += extraOptCfgs[curr] + ';';
                    this.logInfo('add extra vcpkg instal option: ' + extraOptCfgs[curr]);
                }
                extraOptions += '"';
                let cmakeConfigs = this.getAndCleanCMakeOptions(this._vcpkgInstallOptionsConfig);
                cmakeConfigs?.push(extraOptions);
                this.updateCMakeSetting(this._cmakeOptionConfig, cmakeConfigs);
            }
            else {
                let cmakeConfigs = this.getAndCleanCMakeOptions(this._vcpkgInstallOptionsConfig);
                this.updateCMakeSetting(this._cmakeOptionConfig, cmakeConfigs);
            }
        }
        else if (event.affectsConfiguration('vcpkg.' + this._useStaticLibConfig)) {
            let isUseStatic = vscode_1.workspace.getConfiguration('vcpkg').get(this._useStaticLibConfig);
            this.logInfo('detect vcpkg static lib configuration changed to ' + (isUseStatic ? 'static' : 'dynamic'));
            this.useLibType(isUseStatic);
        }
        else if (event.affectsConfiguration('vcpkg.' + this._vcpkgUseDynamicCRTConfig)) {
            let isUseDynamic = vscode_1.workspace.getConfiguration('vcpkg').get(this._vcpkgUseDynamicCRTConfig);
            this.logInfo('detect vcpkg CRT configuration changed to ' + (isUseDynamic ? 'dynamic' : 'static'));
            if (process.platform === "win32") {
                this.useCRTType(isUseDynamic);
            }
        }
        else if (event.affectsConfiguration('vcpkg.' + this._targetTripletConfig)) {
            this.logInfo('detect vcpkg target triplet configuration changed.');
            let currSel = vscode_1.workspace.getConfiguration('vcpkg').get(this._targetTripletConfig);
            this.useLibType(this.isStaticLib(currSel));
        }
    }
    dispose() {
        this.disposables.forEach((item) => item.dispose());
    }
}
exports.ConfigurationManager = ConfigurationManager;
//# sourceMappingURL=configuration%20-%20%E5%89%AF%E6%9C%AC.js.map