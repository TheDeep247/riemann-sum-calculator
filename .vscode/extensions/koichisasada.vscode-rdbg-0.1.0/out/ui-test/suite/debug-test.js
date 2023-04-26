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
const assert = require("assert");
const vscode_extension_tester_1 = require("vscode-extension-tester");
const path = require("path");
const timeoutSec = 60000;
const projectRoot = path.join(__dirname, '..', '..', '..');
const simpleProgramPath = path.join(projectRoot, 'src', 'ui-test', 'testdata', 'simpleProgram');
const importAnotherFilePath = path.join(projectRoot, 'src', 'ui-test', 'testdata', 'importAnotherFile');
const bindingBreakPath = path.join(projectRoot, 'src', 'ui-test', 'testdata', 'bindingBreak');
describe('breakpoint', () => {
    describe('simpleProgram', () => {
        beforeEach(function () {
            return __awaiter(this, void 0, void 0, function* () {
                this.timeout(timeoutSec);
                yield openSampleProgram(simpleProgramPath, 'simpleProgram', 'test.rb');
            });
        });
        afterEach(() => __awaiter(void 0, void 0, void 0, function* () {
            yield cleanup();
        }));
        describe('set breakpoint', () => {
            it('editor', () => __awaiter(void 0, void 0, void 0, function* () {
                const editor = (yield new vscode_extension_tester_1.EditorView().openEditor('test.rb'));
                const expected = 2;
                const result = yield editor.toggleBreakpoint(expected);
                assert.ok(result);
                const view = yield getDebugView();
                yield view.start();
                const bar = yield vscode_extension_tester_1.DebugToolbar.create(timeoutSec);
                yield bar.waitForBreakPoint();
                yield assertLocation(expected, view);
                yield bar.stop();
                return new Promise((resolve, reject) => resolve());
            }));
            it('debug console', () => __awaiter(void 0, void 0, void 0, function* () {
                const editor = (yield new vscode_extension_tester_1.EditorView().openEditor('test.rb'));
                const result = yield editor.toggleBreakpoint(2);
                assert.ok(result);
                const view = yield getDebugView();
                yield view.start();
                const bar = yield vscode_extension_tester_1.DebugToolbar.create(timeoutSec);
                yield bar.waitForBreakPoint();
                yield assertLocation(2, view);
                const debugView = yield new vscode_extension_tester_1.BottomBarPanel().openDebugConsoleView();
                yield assertEvaluate('(rdbg:#debugger) b 3', ',b 3', debugView);
                yield assertEvaluate('(rdbg:#debugger) c', ',c', debugView);
                yield bar.waitForBreakPoint();
                yield assertLocation(3, view);
                yield bar.stop();
                return new Promise((resolve, reject) => resolve());
            }));
        });
        describe('remove breakpoint', () => {
            it('editor', () => __awaiter(void 0, void 0, void 0, function* () {
                const editor = (yield new vscode_extension_tester_1.EditorView().openEditor('test.rb'));
                const expected = 2;
                const result1 = yield editor.toggleBreakpoint(expected);
                assert.ok(result1);
                const view = yield getDebugView();
                yield view.start();
                const bar = yield vscode_extension_tester_1.DebugToolbar.create(timeoutSec);
                yield bar.waitForBreakPoint();
                yield assertLocation(expected, view);
                const result2 = yield editor.toggleBreakpoint(3);
                assert.ok(result2);
                const result3 = yield editor.toggleBreakpoint(4);
                assert.ok(result3);
                // remove breakpoint
                const result4 = yield editor.toggleBreakpoint(3);
                assert.ok(!result4);
                yield bar.continue();
                yield bar.waitForBreakPoint();
                yield assertLocation(4, view);
                yield bar.stop();
                return new Promise((resolve, reject) => resolve());
            }));
            it('debug console', () => __awaiter(void 0, void 0, void 0, function* () {
                const editor = (yield new vscode_extension_tester_1.EditorView().openEditor('test.rb'));
                const expected = 2;
                const result = yield editor.toggleBreakpoint(expected);
                assert.ok(result);
                const view = yield getDebugView();
                yield view.start();
                const bar = yield vscode_extension_tester_1.DebugToolbar.create(timeoutSec);
                yield bar.waitForBreakPoint();
                yield assertLocation(expected, view);
                const debugView = yield new vscode_extension_tester_1.BottomBarPanel().openDebugConsoleView();
                yield assertEvaluate('(rdbg:#debugger) b 3', ',b 3', debugView);
                yield assertEvaluate('(rdbg:#debugger) b 4', ',b 4', debugView);
                yield assertEvaluate('deleted: #1', ',del 1', debugView);
                yield assertEvaluate('(rdbg:#debugger) c', ',c', debugView);
                yield bar.waitForBreakPoint();
                yield assertLocation(4, view);
                yield bar.stop();
                return new Promise((resolve, reject) => resolve());
            }));
        });
    });
    describe('importAnotherFile', () => {
        beforeEach(function () {
            return __awaiter(this, void 0, void 0, function* () {
                this.timeout(timeoutSec);
                yield openSampleProgram(importAnotherFilePath, 'importAnotherFile', 'bar.rb');
            });
        });
        afterEach(() => __awaiter(void 0, void 0, void 0, function* () {
            yield cleanup();
        }));
        it('debug tool bar', () => __awaiter(void 0, void 0, void 0, function* () {
            const barFileTab = (yield new vscode_extension_tester_1.EditorView().openEditor('bar.rb'));
            const result = yield barFileTab.toggleBreakpoint(2);
            assert.ok(result);
            const view = yield getDebugView();
            yield view.start();
            const bar = yield vscode_extension_tester_1.DebugToolbar.create(timeoutSec);
            yield bar.waitForBreakPoint();
            yield assertLocation(2, view);
            yield openFile('importAnotherFile', 'foo.rb');
            // Since the following error ocuurs when using openEditor('foo.rb'), getTabByTitle is used here:
            // ```
            // 	ElementClickInterceptedError: element click intercepted: Element <div draggable="true"...
            // ```
            const fooFileTab = new vscode_extension_tester_1.TextEditor();
            const result2 = yield fooFileTab.toggleBreakpoint(8);
            assert.ok(result2);
            yield bar.continue();
            yield bar.waitForBreakPoint();
            yield assertLocation(8, view);
            yield bar.stop();
            return new Promise((resolve, reject) => resolve());
        }));
        it('debug console', () => __awaiter(void 0, void 0, void 0, function* () {
            const barFileTab = (yield new vscode_extension_tester_1.EditorView().openEditor('bar.rb'));
            const result = yield barFileTab.toggleBreakpoint(2);
            assert.ok(result);
            const view = yield getDebugView();
            yield view.start();
            const bar = yield vscode_extension_tester_1.DebugToolbar.create(timeoutSec);
            yield bar.waitForBreakPoint();
            yield assertLocation(2, view);
            const debugView = yield new vscode_extension_tester_1.BottomBarPanel().openDebugConsoleView();
            yield assertEvaluate('BP - Line', ',b foo.rb:8', debugView);
            yield assertEvaluate('(rdbg:#debugger) c', ',c', debugView);
            yield bar.waitForBreakPoint();
            yield assertLocation(8, view);
            yield bar.stop();
            return new Promise((resolve, reject) => resolve());
        }));
    });
});
describe('step', () => {
    describe('simpleProgram', () => {
        beforeEach(function () {
            return __awaiter(this, void 0, void 0, function* () {
                this.timeout(timeoutSec);
                yield openSampleProgram(simpleProgramPath, 'simpleProgram', 'test.rb');
            });
        });
        afterEach(() => __awaiter(void 0, void 0, void 0, function* () {
            yield cleanup();
        }));
        it('debug tool bar', () => __awaiter(void 0, void 0, void 0, function* () {
            const editor = (yield new vscode_extension_tester_1.EditorView().openEditor('test.rb'));
            const result = yield editor.toggleBreakpoint(2);
            assert.ok(result);
            const view = yield getDebugView();
            yield view.start();
            const bar = yield vscode_extension_tester_1.DebugToolbar.create(timeoutSec);
            yield bar.waitForBreakPoint();
            yield assertLocation(2, view);
            yield bar.stepInto();
            yield assertLocation(3, view);
            yield bar.stepInto();
            yield assertLocation(4, view);
            yield bar.stop();
            return new Promise((resolve, reject) => resolve());
        }));
        it('debug console', () => __awaiter(void 0, void 0, void 0, function* () {
            const editor = (yield new vscode_extension_tester_1.EditorView().openEditor('test.rb'));
            const result = yield editor.toggleBreakpoint(2);
            assert.ok(result);
            const view = yield getDebugView();
            yield view.start();
            const bar = yield vscode_extension_tester_1.DebugToolbar.create(timeoutSec);
            yield bar.waitForBreakPoint();
            yield assertLocation(2, view);
            const debugView = yield new vscode_extension_tester_1.BottomBarPanel().openDebugConsoleView();
            yield assertEvaluate('(rdbg:#debugger) s', ',s', debugView);
            yield assertLocation(3, view);
            yield bar.stop();
            return new Promise((resolve, reject) => resolve());
        }));
    });
});
describe('next', () => {
    describe('simpleProgram', () => {
        beforeEach(function () {
            return __awaiter(this, void 0, void 0, function* () {
                this.timeout(timeoutSec);
                yield openSampleProgram(simpleProgramPath, 'simpleProgram', 'test.rb');
            });
        });
        afterEach(() => __awaiter(void 0, void 0, void 0, function* () {
            yield cleanup();
        }));
        it('debug tool bar', () => __awaiter(void 0, void 0, void 0, function* () {
            const editor = (yield new vscode_extension_tester_1.EditorView().openEditor('test.rb'));
            const view = yield getDebugView();
            const result = yield editor.toggleBreakpoint(2);
            assert.ok(result);
            yield view.start();
            const bar = yield vscode_extension_tester_1.DebugToolbar.create(timeoutSec);
            yield bar.waitForBreakPoint();
            yield assertLocation(2, view);
            yield bar.stepOver();
            yield assertLocation(3, view);
            yield bar.stepOver();
            yield assertLocation(4, view);
            yield bar.stop();
            return new Promise((resolve, reject) => resolve());
        }));
        it('debug console', () => __awaiter(void 0, void 0, void 0, function* () {
            const editor = (yield new vscode_extension_tester_1.EditorView().openEditor('test.rb'));
            const result = yield editor.toggleBreakpoint(2);
            assert.ok(result);
            const view = yield getDebugView();
            yield view.start();
            const bar = yield vscode_extension_tester_1.DebugToolbar.create(timeoutSec);
            yield bar.waitForBreakPoint();
            yield assertLocation(2, view);
            const debugView = yield new vscode_extension_tester_1.BottomBarPanel().openDebugConsoleView();
            yield assertEvaluate('(rdbg:#debugger) n', ',n', debugView);
            yield view.click();
            yield assertLocation(3, view);
            yield bar.stop();
            return new Promise((resolve, reject) => resolve());
        }));
    });
});
describe('eval', () => {
    describe('simpleProgram', () => {
        beforeEach(function () {
            return __awaiter(this, void 0, void 0, function* () {
                this.timeout(timeoutSec);
                yield openSampleProgram(simpleProgramPath, 'simpleProgram', 'test.rb');
            });
        });
        afterEach(() => __awaiter(void 0, void 0, void 0, function* () {
            yield cleanup();
        }));
        it('debug console', () => __awaiter(void 0, void 0, void 0, function* () {
            const editor = (yield new vscode_extension_tester_1.EditorView().openEditor('test.rb'));
            const result = yield editor.toggleBreakpoint(2);
            assert.ok(result);
            const view = yield getDebugView();
            yield view.start();
            const bar = yield vscode_extension_tester_1.DebugToolbar.create(timeoutSec);
            yield bar.waitForBreakPoint();
            yield assertLocation(2, view);
            const debugView = yield new vscode_extension_tester_1.BottomBarPanel().openDebugConsoleView();
            yield assertEvaluate('1', 'a', debugView);
            yield assertEvaluate('nil', 'b', debugView);
            yield bar.stepOver();
            yield assertLocation(3, view);
            yield assertEvaluate('2', 'b', debugView);
            yield bar.stop();
            return new Promise((resolve, reject) => resolve());
        }));
    });
});
describe('binding.break', () => {
    beforeEach(function () {
        return __awaiter(this, void 0, void 0, function* () {
            this.timeout(timeoutSec);
            yield openSampleProgram(bindingBreakPath, 'bindingBreak', 'test.rb');
        });
    });
    afterEach(() => __awaiter(void 0, void 0, void 0, function* () {
        yield cleanup();
    }));
    it('debug tool bar', () => __awaiter(void 0, void 0, void 0, function* () {
        const view = yield getDebugView();
        yield view.start();
        const bar = yield vscode_extension_tester_1.DebugToolbar.create(timeoutSec);
        yield bar.waitForBreakPoint();
        yield assertLocation(5, view);
        yield bar.continue();
        yield assertLocation(8, view);
        yield bar.stop();
        return new Promise((resolve, reject) => resolve());
    }));
});
function assertLocation(expected, view) {
    return __awaiter(this, void 0, void 0, function* () {
        const tree = yield view.getContent().getSection('Call Stack');
        const items = yield tree.getVisibleItems();
        if (items.length === 0) {
            assert.fail("Call Stack Section is not visible");
        }
        const text = yield items[0].getText();
        const location = text.match(/(\d+):(\d+)$/);
        if (location === null || location.length !== 3) {
            assert.fail("Can't get location from Call Stack Section");
        }
        const lineNumber = parseInt(location[1]);
        assert.strictEqual(lineNumber, expected);
    });
}
function getDebugView() {
    return __awaiter(this, void 0, void 0, function* () {
        const control = yield new vscode_extension_tester_1.ActivityBar().getViewControl('Run');
        if (control === undefined) {
            assert.fail("Can't find a View for debug");
        }
        return yield control.openView();
    });
}
function openSampleProgram(path, sectionTitle, targetFileName) {
    return __awaiter(this, void 0, void 0, function* () {
        yield vscode_extension_tester_1.VSBrowser.instance.openResources(path);
        yield openFile(sectionTitle, targetFileName);
    });
}
function openFile(sectionTitle, targetFileName) {
    var _a;
    return __awaiter(this, void 0, void 0, function* () {
        (_a = (yield new vscode_extension_tester_1.ActivityBar().getViewControl('Explorer'))) === null || _a === void 0 ? void 0 : _a.openView();
        const view = new vscode_extension_tester_1.SideBarView();
        const tree = (yield view.getContent().getSection(sectionTitle));
        const item = yield tree.findItem(targetFileName);
        if (item === undefined) {
            assert.fail(`Can't find item: ${item}`);
        }
        yield item.select();
    });
}
function assertEvaluate(expected, expression, view) {
    return __awaiter(this, void 0, void 0, function* () {
        yield view.evaluateExpression(expression);
        yield new Promise(res => setTimeout(res, 1000));
        const text = yield view.getText();
        assert.ok(text.includes(expected), `Expected to include ${expected} in ${text}, but not.`);
        yield view.clearText();
    });
}
function cleanup() {
    var _a, _b;
    return __awaiter(this, void 0, void 0, function* () {
        yield vscode_extension_tester_1.VSBrowser.instance.waitForWorkbench();
        yield new vscode_extension_tester_1.Workbench().executeCommand('Remove All Breakpoints');
        yield new Promise(res => setTimeout(res, 2000));
        yield ((_a = (yield new vscode_extension_tester_1.ActivityBar().getViewControl('Run'))) === null || _a === void 0 ? void 0 : _a.closeView());
        yield ((_b = (yield new vscode_extension_tester_1.ActivityBar().getViewControl('Explorer'))) === null || _b === void 0 ? void 0 : _b.closeView());
        yield new vscode_extension_tester_1.TitleBar().select('File', 'Close Folder');
        yield new vscode_extension_tester_1.EditorView().closeAllEditors();
    });
}
//# sourceMappingURL=debug-test.js.map