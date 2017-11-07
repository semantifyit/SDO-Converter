/*
 ===============
 global variables
 ===============
 */

//global Vars
let PATH_INPUT_SCHEMA = "data_input/schema.jsonld";
let PATH_OUTPUT_DIRECTORY = "data_output";

//libraries
let fs = require('fs');
let del = require('del');

module.exports = function() {
    this.PATH_INPUT_SCHEMA = PATH_INPUT_SCHEMA;
    this.PATH_OUTPUT_DIRECTORY = PATH_OUTPUT_DIRECTORY;
    this.fs = fs;
    this.del = del;
};