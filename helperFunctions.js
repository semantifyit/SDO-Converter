/*
 ===============
 helper functions
 ===============
 */
function uniquifyArray(array) {
    let seen = {};
    let result = [];
    for(let i = 0; i < array.length; i++) {
        let item = array[i];
        if(seen[item] !== 1) {
            seen[item] = 1;
            result.push(item);
        }
    }
    return result;
}

function print(msgType,msg){
    switch (msgType){
        case "i":  console.log("Info: "+msg);break;
        case "w":  console.log("Warning: "+msg);break;
        case "e":  console.log("Error: "+msg);break;
        case "d":  console.log("Debug: "+msg);break;
    }
}

function stringifyJSON(data) {
    return JSON.stringify(data, null, 2);
}

let contextURI = "http://schema.org/";
function clipURIString(str) {
    return str.substr(contextURI.length,str.length-1);
}

function addURIString(str) {
    return contextURI+str;
}

function check_isArray(object){
    return Array.isArray(object);
}

function check_isUndefined(object) {
    return object === undefined;
}

function check_isString(object) {
    return typeof object === "string"
}

function writeDataInLocalFile(outputPath, data){
    console.log("writing data into "+PATH_OUTPUT_DIRECTORY+"/"+outputPath+" .");
    fs.writeFileSync(PATH_OUTPUT_DIRECTORY+"/"+outputPath, data , 'utf-8');
}

/*
 ===============
 debug functions
 ===============
 */
function printOccurrencesNumberOfPropertyOfArray(array,property) {
    let resultArr = {};
    for(i=0;i<array.length;i++){
        let actType = array[i][property];
        if(resultArr[actType]>0){
            resultArr[actType] = resultArr[actType] + 1;
        } else {
            resultArr[actType] = 1 ;
        }
    }
    print("d",stringifyJSON(resultArr));
}


function printArrayOccurrences(array, property) {
    for(i=0;i<array.length;i++){
        let actDataRow = array[i];
        if(Array.isArray(actDataRow[property])){
            print("d","Object '"+JSON.stringify(actDataRow)+"' has array for "+property);
        }
    }
}
function printAmountOfPropertiesForObject(arr, name) {
    print("d","Object '"+name+"' has "+Object.keys(arr).length+" properties.");
}

function printErrorLog(errors) {
    for(let i=0; i < errors.length; i++){
        print("d",errors[i].message+"\nPayload: "+JSON.stringify(errors[i].payload));
    }
}

function cloneJSON(json){
    return JSON.parse(JSON.stringify(json));
}

module.exports = function() {
    this.printErrorLog = printErrorLog;
    this.printAmountOfPropertiesForObject = printAmountOfPropertiesForObject;
    this.printArrayOccurrences = printArrayOccurrences;
    this.printOccurrencesNumberOfPropertyOfArray = printOccurrencesNumberOfPropertyOfArray;
    this.writeDataInLocalFile = writeDataInLocalFile;
    this.check_isString = check_isString;
    this.check_isUndefined = check_isUndefined;
    this.check_isArray = check_isArray;
    this.addURIString = addURIString;
    this.clipURIString = clipURIString;
    this.stringifyJSON = stringifyJSON;
    this.print = print;
    this.uniquifyArray = uniquifyArray;
    this.cloneJSON = cloneJSON;
}