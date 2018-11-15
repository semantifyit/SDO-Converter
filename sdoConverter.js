const PATH_INPUT_DIRECTORY = "data_input";
const PATH_OUTPUT_DIRECTORY = "data_output";
let argv = require('minimist')(process.argv.slice(2));
let download = require('./download.js');
let convert = require('./convert.js');

app();
async function app() {
    if (argv["_"].length !== 1) {
        console.log("Please provide exactly 1 command for the converter. e.g. 'start', 'download', or 'convert'.");
        process.exit();
    } else {
        let version = "latest";
        if (argv["version"] !== undefined) {
            version = argv["version"];
        }
        let minify = true;
        if (argv["minify"] !== undefined) {
            minify = argv["minify"];
        }
        let materialize = false;
        if (argv["materialize"] !== undefined) {
            materialize = argv["materialize"];
        }
        switch (argv["_"][0]) {
            case "start":
                try {
                    await download(PATH_INPUT_DIRECTORY, version);
                    await convert(PATH_OUTPUT_DIRECTORY,PATH_INPUT_DIRECTORY, version, minify, materialize);
                } catch (e) {
                }
                break;
            case "download":
                try {
                    await download(PATH_INPUT_DIRECTORY, version);
                } catch (e) {
                }
                break;
            case "convert":
                try {
                    await convert(PATH_OUTPUT_DIRECTORY,PATH_INPUT_DIRECTORY, version, minify, materialize);
                } catch (e) {
                }
                break;
            case "help":
                console.log("Usage" +
                    "\n=======" +
                    "\nsdoConverter COMMAND (--OPTION)*" +
                    "\n\ndefault: 'sdoCoverter start --version=latest --materialize=false --minify=true'"+
                    "\n\nCommands" +
                    "\n=======" +
                    "\nstart -> fetches the schema.jsonld from Schema.org AND starts the converting algorithm." +
                    "\ndownload -> fetches the schema.jsonld from Schema.org." +
                    "\ncovert -> starts the converting algorithm."+
                    "\nhelp -> shows this information."+
                    "\n\nOptions" +
                    "\n=======" +
                    "\n--version -> specifies the version of Schema.org to download/convert. e.g. 3.1 or latest" +
                    "\n--materialize -> the output data will be saved as one big materialized file. true/false" +
                    "\n--minify -> the output data will be saved without white spaces. true/false");
                break;
            default:
                console.log("Please provide a valid command for the converter. e.g. 'start', 'download', or 'convert'.");
                break;
        }
    }
}

