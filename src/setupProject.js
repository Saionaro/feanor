const spawn = require("cross-spawn");
const path = require("path");
const fs = require("fs");
const util = require("util");
const Mustache = require("mustache");
const opener = require("opener");
const fp = require("find-free-port");
const { delay } = require("nanodelay");

const log = require("./log.js");

const mkdir = util.promisify(fs.mkdir);
const readFile = util.promisify(fs.readFile);
const writeFile = util.promisify(fs.writeFile);
const copyFile = util.promisify(fs.copyFile);

const BASE_PORT = 3000;

const STYLE_ENGINES = {
  css: { ext: "css", packages: [] },
  less: { ext: "less", packages: [] },
  sass: { ext: "scss", packages: ["sass"] },
};
/**
 * Callback generator for process exit callbacks.
 * @param {function} resolve Promise resolve callback
 * @param {function} reject Promise reject callback
 * @param {string} command Command invoked
 * @param {string[]} args Command args invoked
 */
function handleProcessExit(resolve, reject, command, args) {
  return (code) => {
    if (code !== 0) {
      return reject({
        command: `${command} ${args.join(" ")}`,
      });
    }
    resolve();
  };
}
/**
 * Add some magic to package.json
 * @param {string} root Project root folder
 * @returns {Promise<void>}
 */
async function modifyPackageFile(root) {
  const packageJSONPath = path.join(root, "package.json");

  let packageJSONCOntent = JSON.parse(await readFile(packageJSONPath, "utf-8"));

  packageJSONCOntent["browserslist"] = ["defaults"];

  packageJSONCOntent["scripts"] = {
    build: "parcel build src/*.html",
    dev: "parcel src/*.html",
    lint: "eslint src/**/*.js --no-error-on-unmatched-pattern",
  };

  await writeFile(packageJSONPath, JSON.stringify(packageJSONCOntent, null, 2));

  log("🧟‍  Precommit hooks added");
}
/**
 * Inject eslint
 * @param {string} root Project root folder
 * @returns {Promise<void>}
 */
async function injectEslint(root) {
  const srcStylePath = path.join(__dirname, "templates/eslintrc.json");
  const dstStylePath = path.join(root, ".eslintrc");

  await copyFile(srcStylePath, dstStylePath);

  log("👮‍ ESLint injected");
}
/**
 * Inject stylelint
 * @param {string} root Project root folder
 * @returns {Promise<void>}
 */
async function injectStylelint(root) {
  const srcStylePath = path.join(__dirname, "templates/stylelintrc.json");
  const dstStylePath = path.join(root, ".stylelintrc");

  await copyFile(srcStylePath, dstStylePath);

  log("👨‍🎨 Stylelint injected");
}
/**
 * Inject lefthook
 * @param {string} root Project root folder
 * @returns {Promise<void>}
 */
async function injectLefthook(root) {
  const srcStylePath = path.join(__dirname, "templates/lefthook.yml");
  const dstStylePath = path.join(root, "lefthook.yml");

  await copyFile(srcStylePath, dstStylePath);

  log("🥊 Lefthook injected");
}
/**
 * Inject posthtmlrc file
 * @param {string} root Project root folder
 * @returns {Promise<void>}
 */
async function injectPosthtml(root) {
  const srcStylePath = path.join(__dirname, "templates/posthtmlrc.json");
  const dstStylePath = path.join(root, ".posthtmlrc");

  await copyFile(srcStylePath, dstStylePath);

  log("📚 Posthtml injected");
}
/**
 * Add js-friendly gitignore file
 * @param {string} root Project root folder
 * @returns {Promise<void>}
 */
async function addGitignore(root) {
  const srcStylePath = path.join(__dirname, "templates/gitignore");
  const dstStylePath = path.join(root, ".gitignore");

  await copyFile(srcStylePath, dstStylePath);

  log("🙈 Gitignore added");
}
/**
 * Add js-friendly gitignore file
 * @param {string} root Project root folder
 * @returns {Promise<void>}
 */
async function addPostcssConfig(root) {
  const srcStylePath = path.join(__dirname, "templates/postcssrc.json");
  const dstStylePath = path.join(root, ".postcssrc");

  await copyFile(srcStylePath, dstStylePath);

  log("😈 POSTCSS config added");
}
/**
 * Creates basic readme file
 * @param {string} root Project root folder
 * @param {string} projectName Just a project name
 * @returns {Promise<void>}
 */
async function addReadme(root, projectName) {
  const srcStylePath = path.join(__dirname, "templates/readme.js");
  const dstStylePath = path.join(root, "README.md");

  const getReadme = require(srcStylePath);

  await writeFile(dstStylePath, getReadme(projectName));

  log("📖 Readme injected");
}
/**
 * Creates project index file
 * @param {object} params Params object
 * @param {string} params.projectRoot Project root folder
 * @param {string} params.projectName Project name
 * @param {object} params.styleEngine Styling engine
 * @param {string} params.styleEngine.ext Styling engine file extention
 * @param {string} params.lang Target language
 * @returns {Promise<void>}
 */
async function createIndex({
  projectRoot,
  projectName,
  styleEngine,
  lang = "en",
}) {
  const templatePath = path.join(__dirname, "templates/index.mustache");
  const template = await readFile(templatePath, "utf-8");
  const styleExt = styleEngine.ext;

  const indexContent = Mustache.render(template, {
    projectName,
    styleExt,
    lang,
  });
  const destinationPath = path.join(projectRoot, "src", "index.html");

  await writeFile(destinationPath, indexContent);

  const srcStylePath = path.join(__dirname, "templates/index.css");
  const dstStylePath = path.join(
    projectRoot,
    "src",
    "styles",
    `index.${styleExt}`
  );

  await copyFile(srcStylePath, dstStylePath);

  log("🏗  Created site root");
}
/**
 * Init git repository at the project root
 * @param {string} root Project root
 * @returns {Promise<void>}
 */
function initGit(root) {
  return new Promise((resolve, reject) => {
    const command = "git";
    const args = ["init", root];

    const process = spawn(command, args, { stdio: "inherit" });

    process.on("close", handleProcessExit(resolve, reject, command, args));
  });
}
/**
 * Init yarn project at the requred root
 * @param {string} root Project root
 * @returns {Promise<void>}
 */
function init(root) {
  return new Promise((resolve, reject) => {
    const command = "yarn";
    const args = ["--cwd", root, "init", "-y"];

    const process = spawn(command, args, { stdio: "inherit" });

    process.on("close", handleProcessExit(resolve, reject, command, args));
  });
}
/**
 * Install primary dependencies at project directory
 * @param {string} root Project root
 * @param {string[]} deps Dependencies list
 * @param {boolean} isDev Install as dev dependencies
 * @returns {Promise<void>}
 */
function install(root, deps = [], isDev = false) {
  return new Promise((resolve, reject) => {
    const command = "yarn";
    const args = ["--cwd", root, "add", "--exact", ...deps];

    if (isDev) {
      args.push("-D");
    }

    const process = spawn(command, args, { stdio: "inherit" });

    process.on("close", handleProcessExit(resolve, reject, command, args));
  });
}
/**
 * Create new project directory and setup project
 * @param {object} argv Project creation arguments.
 * @param {string} argv.name Project name
 * @param {boolean} argv.less Using less in project
 * @param {boolean} argv.sass Using sass in project
 * @returns {Promise<void>}
 */
async function setupProject(argv) {
  const projectName = argv.name;
  let styleEngine;

  if (argv.less) {
    styleEngine = STYLE_ENGINES.less;
  } else if (argv.sass) {
    styleEngine = STYLE_ENGINES.sass;
  } else {
    styleEngine = STYLE_ENGINES.css;
  }

  await mkdir(projectName);

  const projectRoot = path.join(process.cwd(), projectName);
  const getPath = path.join.bind(this, projectRoot);

  await init(projectRoot);

  await initGit(projectRoot);

  await install(
    projectRoot,
    [
      "eslint",
      "eslint-config-prettier",
      "stylelint-config-recommended",
      "stylelint-config-prettier",
      "@arkweid/lefthook",
      "prettier",
      "parcel",
      "parcel-plugin-clean-dist",
      "autoprefixer",
      "posthtml",
      "posthtml-modules",
      ...styleEngine.packages,
    ],
    true
  );

  await Promise.all([
    mkdir(getPath("dist")),
    mkdir(getPath("src")),
    injectEslint(projectRoot),
    injectStylelint(projectRoot),
    injectPosthtml(projectRoot),
    injectLefthook(projectRoot),
    addPostcssConfig(projectRoot),
    addReadme(projectRoot, projectName),
    modifyPackageFile(projectRoot),
    addGitignore(projectRoot),
  ]);

  await Promise.all([
    mkdir(getPath("src", "images")),
    mkdir(getPath("src", "fonts")),
    mkdir(getPath("src", "js")),
    mkdir(getPath("src", "styles")),
  ]);

  const keepfile = ".gitkeep";

  await Promise.all([
    createIndex({ projectRoot, projectName, styleEngine }),
    writeFile(getPath("src", "images", keepfile), ""),
    writeFile(getPath("src", "fonts", keepfile), ""),
    writeFile(getPath("src", "js", keepfile), ""),
  ]);

  log("🚀 We are ready to launch...");

  const ports = await fp(BASE_PORT);

  if (ports.length) {
    const port = ports[0];
    const args = ["--cwd", projectRoot, "dev", "--port", port];

    spawn("yarn", args, { stdio: "inherit" });

    await delay(2500);

    opener(`http://localhost:${port}`);
  }
}

module.exports = setupProject;
