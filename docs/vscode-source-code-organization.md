Original document: https://github.com/microsoft/vscode/wiki/Source-Code-Organization

Layers
The core is partitioned into the following layers:

- base: Provides general utilities and user interface building blocks that can be used in any other layer.
- platform: Defines service injection support and the base services for VS Code that are shared across layers such as workbench and code. Should not include editor or workbench specific services or code.
- editor: The "Monaco" editor is available as a separate downloadable component.
- workbench: Hosts the "Monaco" editor, notebooks and custom editors and provides the framework for panels like the Explorer, Status Bar, or Menu Bar, leveraging Electron to implement the VS Code desktop application and browser APIs to provide VS Code for the Web.
- code: The entry point to the desktop app that stitches everything together, this includes the Electron main file, shared process, and the CLI for example.
- server: The entry point to our server app for remote development.


Target Environments:

The core of VS Code is fully implemented in TypeScript. Inside each layer the code is organised by the target runtime environment. This ensures that only the runtime specific APIs are used. In the code we distinguish between the following target environments:


- common: Source code that only requires basic JavaScript APIs and run in all the other target environments
- browser: Source code that requires Web APIs, eg. DOM
  - may use code from: common
- node: Source code that requires Node.JS APIs
  - may use code from: common
- electron-sandbox: Source code that requires the browser APIs like access to the DOM and a small subset of APIs to communicate with the Electron main process (anything exposed from src/vs/base/parts/sandbox/electron-sandbox/globals.ts
  - may use code from: common, browser, electron-sandbox
- electron-utility: Source code that requires the Electron utility-process APIs
  - may use code from: common, node
- electron-main: Source code that requires the Electron main-process APIs
  - may use code from: common, node, electron-utility

# Dependency Injection

## Consuming a service

The code is organised around services of which most are defined in the platform layer. Services get to its clients via constructor injection.

A service definition is two parts: (1) the interface of a service, and (2) a service identifier - the latter is required because TypeScript doesn't use nominal but structural typing. A service identifier is a decoration (as proposed for ES7) and should have the same name as the service interface.

Declaring a service dependency happens by adding a corresponding decoration to a constructor argument. In the snippet below @IModelService is the service identifier decoration and IModelService is the (optional) type annotation for this argument.


## Consuming a service

```
class Client {
  constructor(
    @IModelService modelService: IModelService
  ) {
    // use services
  }
}
```

Use the instantiation service to create instances for service consumers, like so instantiationService.createInstance(Client). Usually, this is done for you when being registered as a contribution, like a Viewlet or Language.

## Providing a service

The best way to provide a service to others or to your own components is the registerSingleton-function. It takes a service identifier and a service constructor function.

```
registerSingleton(
  ISymbolNavigationService, // identifier
  SymbolNavigationService,  // ctor of an implementation
  InstantiationType.Delayed // delay instantiation of this service until is actually needed
);
```

Add this call into a module-scope so that it is executed during startup. The workbench will then know this service and be able to pass it onto consumers.



Here's your content converted into structured and readable Markdown:

---

# VS Code Source Organization

## `vs/editor` Folder

* **No node or electron-* dependencies*\* should exist in this folder.

### Subfolders

* `vs/editor/common` and `vs/editor/browser`

  * The **core of the code editor**.
  * Contains critical code **without which the editor does not make sense**.

* `vs/editor/contrib`

  * Contains **code editor contributions** that ship in **both VS Code and the standalone editor**.
  * **Depends on `browser` by convention**.
  * Editor can function without these; removing them removes their respective features.

* `vs/editor/standalone`

  * Contains **code that ships only with the standalone editor**.
  * **Nothing else should depend on this folder**.

* `vs/workbench/contrib/codeEditor`

  * Code editor contributions that **only ship in VS Code**.

---

Here's your content converted into structured and readable Markdown:

---

# VS Code Source Organization

## `vs/editor` Folder

* **No node or electron-* dependencies*\* should exist in this folder.

### Subfolders

* `vs/editor/common` and `vs/editor/browser`

  * The **core of the code editor**.
  * Contains critical code **without which the editor does not make sense**.

* `vs/editor/contrib`

  * Contains **code editor contributions** that ship in **both VS Code and the standalone editor**.
  * **Depends on `browser` by convention**.
  * Editor can function without these; removing them removes their respective features.

* `vs/editor/standalone`

  * Contains **code that ships only with the standalone editor**.
  * **Nothing else should depend on this folder**.

* `vs/workbench/contrib/codeEditor`

  * Code editor contributions that **only ship in VS Code**.

---

# VS Code Workbench Source Organization

The **`vs/workbench`** folder contains components for a **rich development experience**, such as full text search, integrated Git, and debugging.

### Core Workbench Structure

* `vs/workbench/{common|browser|electron-sandbox}`

  * **Minimal core** of the workbench.

* `vs/workbench/api`

  * Provides the **`vscode.d.ts` API** (used by both extension host and workbench implementations).

* `vs/workbench/services`

  * Contains **core workbench services**.
  * **Should NOT include services used only in `vs/workbench/contrib`**.

* `vs/workbench/contrib`

  * **Main location for contributions** to the workbench.

---

## `vs/workbench/contrib` Rules

* **No dependencies from outside `vs/workbench/contrib` into `vs/workbench/contrib`**.

* Each contribution should include a **single `.contribution.ts` file**
  *Example: `vs/workbench/contrib/search/browser/search.contribution.ts`*

  * These files are added to the **main entry points for the product**.

* If a **new service is only used by a single contrib**, it's recommended to:

  * **Register the service in the contrib entrypoint file**.

* Each contribution should expose its **internal API from a single file**
  *Example: `vs/workbench/contrib/search/common/search.ts`*.

* A contribution **can depend on the internal API of another contribution**
  *Example: the `git` contribution may depend on `vs/workbench/contrib/search/common/search.ts`*.

* A contribution should **never access the internal parts** of another contribution

  * Internal = anything not in the common API file.

* Carefully consider **whether a contribution should depend on another**:

  * Is the dependency necessary?
  * Could it be avoided using the **workbench extensibility mechanisms**?

---
