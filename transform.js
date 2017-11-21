/*
 ===============
 transform.js
 ===============
 */
//include other files
let fs = require('fs');
let del = require('del');

//programming objects
let PATH_INPUT_SCHEMA = "data_input/schema.jsonld";
let PATH_OUTPUT_DIRECTORY = "data_output";

let inputDataRows = {}; //input data as graph nodes (we call them data rows here)
let errors = []; //error log

let memory_classes = {};        //classes without enumerations, enumeration instances and dataTypes
let memory_properties = {};     //properties
let memory_dataTypes = {};      //dataType classes
let memory_enumerations = {};   //enumeration classes
let memory_enumerationMembers = {}; //enumeration instances

let COUNTER_DATAROW_CLASS_SUPERSEDED = 0; //amount of skipped class data rows because they got superseded
let COUNTER_DATAROW_PROPERTY_SUPERSEDED = 0; //amount of skipped property data rows because they got superseded
let COUNTER_DATAROW_DATATYPE_SUPERSEDED = 0; //amount of skipped dataType data rows because they got superseded
let COUNTER_DATAROW_ENUMERATIONMEMBER_SUPERSEDED = 0; //amount of skipped enumeration data rows because they got superseded
let COUNTER_DATAROW_ERROR = 0; //amount of skipped data rows which contained errors

let outputData_classes = {};            //sdo_classes.jsonld
let outputData_properties = {};         //sdo_properties.jsonld
let outputData_enumerations = {};       //sdo_enumerations.jsonld
let outputData_enumerationMembers = {}; //sdo_enumerationMembers.jsonld
let outputData_dataTypes = {};          //sdo_dataTypes.jsonld
let outputData_classesMaterialized = {};//sdo_classesMaterialized.jsonld

/*
 ===============
 Algorithm Start
 ===============
*/
init();
function init() {
    cleanOutputDirectory();
    //Algorithm Step A
    startProcessLoadSchemaJSONLD();
}

//deletes all files in the output directory
function cleanOutputDirectory(){
    del.sync([PATH_OUTPUT_DIRECTORY+"/**","!"+PATH_OUTPUT_DIRECTORY]);
    print("i","All files in output directory '"+PATH_OUTPUT_DIRECTORY+"' deleted.");
}

//Load the Input JSONLD file
function startProcessLoadSchemaJSONLD(){
    if(fs.existsSync(PATH_INPUT_SCHEMA)) {
        fs.readFile(PATH_INPUT_SCHEMA, 'utf8', function (err, data) {
            inputDataRows = JSON.parse(data);
            inputDataRows = inputDataRows["@graph"];
            startProcessTransformJSONLD();
        });
    } else {
        print("e", "Could not find input file '"+PATH_INPUT_SCHEMA+"'. Please change the let PATH_INPUT_SCHEMA or put the JSON-LD File in that path (you can download the latest version from http://schema.org/docs/developers.html#formats)");
    }
}

//Starts the transformation and generation of data.
function startProcessTransformJSONLD(){

    //Algorithm Step B
    classifyInput();

    //Algorithm Step C.1
    extractEnumerationFromClasses();
    //Algorithm Step C.2
    extractDataTypesFromClasses();
    //Algorithm Step C.3
    //removeBlackListedClasses(); //commented out on purpose, user may use the function if he wants

    //Algorithm Step D.1
    inheritance_classes();
    inheritance_enumerations();
    //Algorithm Step D.2
    inheritance_dataTypes();
    //Algorithm Step D.3
    inheritance_properties();

    //Algorithm Step E.1
    relationships_classes();
    //Algorithm Step E.2
    relationships_enumerations();
    //Algorithm Step E.3
    relationships_fillProperties();

    //Algorithm Step F.1
    outputCreate_classes();
    outputCreate_properties();
    outputCreate_dataTypes();
    outputCreate_enumerations();
    outputCreate_enumerationMembers();
    //Algorithm Step F.2
    outputCreate_classesMaterialized();

    //Algorithm Step G.
    exportOutputFiles();
    exportMinifiedOutputFiles();
    exportErrorFiles();
    exportMetaFiles();
}

/*
 ===============
 Main Processes
 ===============
 */
//checks the dataRows and classifies them in the corresponding category
function classifyInput() {
    for(let i=0;i<inputDataRows.length;i++){
        //check @type of the dataRow
        let type = inputDataRows[i]["@type"];
        //if @type is an Array
        if(check_isArray(type)){
            let isDataType = false;
            for(let j=0;j<type.length;j++) {
                if (type[j] === "http://schema.org/DataType") {
                    isDataType = true;
                    break;
                }
            }
            if(isDataType === true) {
                //add to DataType collection
                addDataType(inputDataRows[i]);
            } else {
                //there is no type
                errors.push({
                    "message": "DataRow with multiple @type entries, which is not a DataType.",
                    "payload": inputDataRows[i]
                });
                COUNTER_DATAROW_ERROR++;
            }
        } else if (check_isString(type)) {
            //@type is a string
            switch (type){
                case "rdfs:Class":
                    addClass(inputDataRows[i]);
                    break;
                case "rdf:Property":
                    addProperty(inputDataRows[i]);
                    break;
                case "http://schema.org/DataType":
                    errors.push({
                        "message": "DataRow has a @type entry which is DataType (non Array).",
                        "payload": inputDataRows[i]
                    });
                    COUNTER_DATAROW_ERROR++;
                    break;
                default:
                    //enumeration member
                    if(type.substring(0,("http://schema.org/".length)) === "http://schema.org/") {
                        addEnumerationMember(inputDataRows[i]);
                    } else {
                        //expected to be an error in the file
                        errors.push({
                            "message": "DataRow has an unknown @type entry.",
                            "payload": inputDataRows[i]
                        });
                        COUNTER_DATAROW_ERROR++;
                    }
                    break;
            }
        } else if (check_isUndefined(type)) {
            //there is no type
            errors.push({
                "message": "DataRow has no @type.",
                "payload": inputDataRows[i]
            });
            COUNTER_DATAROW_ERROR++;
        } else {
            //type is something else
            errors.push({
                "message": "DataRow has a @type which is not handled right.",
                "payload": inputDataRows[i]
            });
            COUNTER_DATAROW_ERROR++;
        }
    }
}

//checks if a data row for a class should create an entry in the memory and executes the process if needed
function addClass(classDataRow){
    if(!check_isUndefined(classDataRow["http://schema.org/supersededBy"])){
        // If this class has the supersededBy property, it should not be added since this class should not be used for new annotations
        COUNTER_DATAROW_CLASS_SUPERSEDED++;
        return false;
    }
    let className = classDataRow["rdfs:label"];
    if (check_isUndefined(memory_classes[className])) {
        //there is not yet a class with this name -> create object
        let classObject = {};
        classObject.name = classDataRow["rdfs:label"];
        classObject.description = classDataRow["rdfs:comment"];
        classObject.type = "Class";
        classObject.superClasses = [];
        classObject.subClasses = [];
        let actClassParentsObj = classDataRow["rdfs:subClassOf"];
        if (!check_isUndefined(actClassParentsObj)) {
            //there are superClasses
            let superClasses = [];
            if (check_isArray(actClassParentsObj)) {
                //array
                superClasses = actClassParentsObj;
            } else {
                //not array -> suppose string
                superClasses.push(actClassParentsObj);
            }
            for (let i = 0; i < superClasses.length; i++) {
                let actSuperClass = clipURIString(superClasses[i]["@id"]);
                if(actSuperClass !== ""){
                    classObject.superClasses.push(actSuperClass);
                }
            }
        }
        memory_classes[className] = classObject;
    } else {
        //class with this name already added
        errors.push({
            "message": "DataRow (Class) has a label which has already been used. (duplicate label)",
            "payload": classDataRow
        });
        COUNTER_DATAROW_ERROR++;
    }
}

//checks if a data row for an enumeration member should create an entry in the memory and executes the process if needed
function addEnumerationMember(enumerationMemberDataRow){
    if(!check_isUndefined(enumerationMemberDataRow["http://schema.org/supersededBy"])){
        // If this enumeration has the supersededBy property, it should not be added since this enumeration should not be used for new annotations
        COUNTER_DATAROW_ENUMERATIONMEMBER_SUPERSEDED++;
        return false;
    }
    let enumerationName = enumerationMemberDataRow["rdfs:label"];
    if (check_isUndefined(memory_enumerationMembers[enumerationName])) {
        //there is not yet a class with this name -> create object
        let enumerationObject = {};
        enumerationObject.name = enumerationMemberDataRow["rdfs:label"];
        enumerationObject.description = enumerationMemberDataRow["rdfs:comment"];
        enumerationObject.type = "EnumerationMember";
        enumerationObject.domainEnumeration = null;
        let actClassFor = enumerationMemberDataRow["@type"];
        if (!check_isUndefined(actClassFor)) {
            //there are classes for this enumeration
            enumerationObject.domainEnumeration = clipURIString(actClassFor);
            memory_enumerationMembers[enumerationName] = enumerationObject;
        } else {
            //there is no class for this enumeration
            errors.push({
                "message": "DataRow (Enumeration) misses a Class for which the enumeration is an instance for.",
                "payload": enumerationMemberDataRow
            });
        }
    } else {
        //enumeration with this name already added
        errors.push({
            "message": "DataRow (Enumeration) has a label which has already been used. (duplicate label)",
            "payload": enumerationMemberDataRow
        });
        COUNTER_DATAROW_ERROR++;
    }
}

//checks if a data row for a dataType should create an entry in the memory and executes the process if needed
function addDataType(dataTypeDataRow){
    if(!check_isUndefined(dataTypeDataRow["http://schema.org/supersededBy"])){
        // If this dataType has the supersededBy property, it should not be added since this data type should not be used for new annotations
        COUNTER_DATAROW_DATATYPE_SUPERSEDED++;
        return false;
    }
    let dataTypeName = dataTypeDataRow["rdfs:label"];
    if (check_isUndefined(memory_dataTypes[dataTypeName])) {
        //there is not yet a dataType with this name -> create object
        let dataTypeObject = {};
        dataTypeObject.name = dataTypeDataRow["rdfs:label"];
        dataTypeObject.description = dataTypeDataRow["rdfs:comment"];
        dataTypeObject.type = "DataType";
        dataTypeObject.superClasses = [];
        dataTypeObject.subClasses = [];
        let actClassParentsObj = dataTypeDataRow["rdfs:subClassOf"];
        if (!check_isUndefined(actClassParentsObj)) {
            //there are superClasses
            let superClasses = [];
            if (check_isArray(actClassParentsObj)) {
                //array
                superClasses = actClassParentsObj;
            } else {
                //not array -> suppose string
                superClasses.push(actClassParentsObj);
            }
            for (let i = 0; i < superClasses.length; i++) {
                let actSuperClass = clipURIString(superClasses[i]["@id"]);
                if(actSuperClass !== ""){
                    dataTypeObject.superClasses.push(actSuperClass);
                }
            }
        }
        memory_dataTypes[dataTypeName] = dataTypeObject;
    } else {
        //data type with this name already added
        errors.push({
            "message": "DataRow (DataType) has a label which has already been used. (duplicate label)",
            "payload": dataTypeDataRow
        });
        COUNTER_DATAROW_ERROR++;
    }
}

//checks if a data row for a property should create an entry in the memory and executes the process if needed
function addProperty(propertyDataRow){
    if(!check_isUndefined(propertyDataRow["http://schema.org/supersededBy"])){
        // If this class has the supersededBy property, it should not be added since this property should not be used for new annotations
        COUNTER_DATAROW_PROPERTY_SUPERSEDED++;
        return false;
    }
    let propertyName = propertyDataRow["rdfs:label"];
    if (check_isUndefined(memory_properties[propertyName])) {
        //there is not yet a property with this name -> create object
        let propertyObject = {};
        propertyObject.name = propertyDataRow["rdfs:label"];
        propertyObject.description = propertyDataRow["rdfs:comment"];
        propertyObject.type = "Property";
        propertyObject.superProperties = [];
        propertyObject.subProperties = [];
        propertyObject.domainClasses = []; //domain
        propertyObject.valueTypes = []; //range
        let actPropertyParentsObj = propertyDataRow["rdfs:subPropertyOf"];
        if (!check_isUndefined(actPropertyParentsObj)) {
            //there are superProperties
            let superProperties = [];
            if (check_isArray(actPropertyParentsObj)) {
                //array
                superProperties = actPropertyParentsObj;
            } else {
                //not array -> suppose string
                superProperties.push(actPropertyParentsObj);
            }
            for (let i = 0; i < superProperties.length; i++) {
                let actSuperProperty = clipURIString(superProperties[i]["@id"]);
                if(actSuperProperty !== ""){
                    propertyObject.superProperties.push(actSuperProperty);
                }
            }
        }
        let domainsObj = propertyDataRow["http://schema.org/domainIncludes"];
        if (!check_isUndefined(domainsObj)) {
            //there are domain classes
            let domains = [];
            if (check_isArray(domainsObj)) {
                //array
                domains = domainsObj;
            } else {
                //not array -> suppose string
                domains.push(domainsObj);
            }
            for (let i = 0; i < domains.length; i++) {
                propertyObject.domainClasses.push(clipURIString(domains[i]["@id"]));
            }
        }
        let rangeObj = propertyDataRow["http://schema.org/rangeIncludes"];
        if (!check_isUndefined(rangeObj)) {
            //there are range classes
            let ranges = [];
            if (check_isArray(rangeObj)) {
                //array
                ranges = rangeObj;
            } else {
                //not array -> suppose string
                ranges.push(rangeObj);
            }
            for (let i = 0; i < ranges.length; i++) {
                propertyObject.valueTypes.push(clipURIString(ranges[i]["@id"]));
            }
        }
        memory_properties[propertyName] = propertyObject;
    } else {
        //property with this name already added
        errors.push({
            "message": "DataRow (Property) has a label which has already been used. (duplicate label)",
            "payload": propertyDataRow
        });
        COUNTER_DATAROW_ERROR++;
    }
}

//check if there are subclasses of enumerations which are in the classes data, put them in enumerations data
function extractEnumerationFromClasses() {
    let counterChanges = 0;
    let keyArray = Object.keys(memory_classes);
    for (let i = 0; i < keyArray.length; i++) {
        let actClass =  memory_classes[keyArray[i]];
        for (let j = 0; j < actClass["superClasses"].length; j++) { //only "Thing" has no superClasses
            //Enumerations have only 1 superclass -> "Enumeration"
            if(actClass["superClasses"][j] === "Enumeration"){
                //this class is an enumeration
                actClass.type = "Enumeration";
                actClass.enumerationMembers = [];
                memory_enumerations[keyArray[i]] = actClass;
                delete memory_classes[keyArray[i]];
                counterChanges++;
                break;
            }
        }
    }
    if(counterChanges > 0){
        extractEnumerationFromClasses(); //do again until there are no changes
    }
}

//check if there are subclasses of dataTypes which are in the classes data, put them in dataType data
function extractDataTypesFromClasses() {
    let counterChanges = 0;
    let keyArray = Object.keys(memory_classes);
    for (let i = 0; i < keyArray.length; i++) {
        let actClass =  memory_classes[keyArray[i]];
        for (let j = 0; j < actClass["superClasses"].length; j++) { //only "Thing" has no superClasses
            if(!check_isUndefined(memory_dataTypes[actClass["superClasses"][j]])){
                //this class is subclass of a dataType
                actClass.type = "DataType";
                memory_dataTypes[keyArray[i]] = actClass;
                delete memory_classes[keyArray[i]];
                counterChanges++;
                break;
            }
        }
    }
    if(counterChanges > 0){
        extractDataTypesFromClasses(); //do again until there are no changes
    }
}

//remove classes which are black listed (because eg. they belong to meta data, it does not make sense to use them?)
function removeBlackListedClasses() {
    let blackListenedClasses = [
        "Enumeration", "DataType", "Intangible"
    ];
    let keyArray = Object.keys(memory_classes);
    for (let i = 0; i < keyArray.length; i++) {
        if(blackListenedClasses.indexOf(keyArray[i]) >= 0 ){
            //class is blacklisted, remove from classList
            delete memory_classes[keyArray[i]];
        }
    }
}

//check superclasses for all classes. Add these classes as subclasses for the parent class/enumeration
function inheritance_classes() {
    let keyArray = Object.keys(memory_classes);
    for (let i = 0; i < keyArray.length; i++) {
        let actSubClass =  memory_classes[keyArray[i]];
        for (let j = 0; j < actSubClass["superClasses"].length; j++) {
            let actSuperClassName = actSubClass["superClasses"][j];
            if(!check_isUndefined(memory_classes[actSuperClassName])){
                //add only if class is available
                memory_classes[actSuperClassName]["subClasses"].push(actSubClass.name);
            } else if(!check_isUndefined(memory_enumerations[actSuperClassName])){
                //add only if enumeration is available
                memory_enumerations[actSuperClassName]["subClasses"].push(actSubClass.name);
            } else {
                //superclass is not in classes memory nor in enumerations memory
                errors.push({
                    "message": "Class has a superClass which is not in classes memory nor in enumerations memory.",
                    "payload": actSubClass
                });
                print("d"," inheritance_classes "+JSON.stringify(actSubClass.name)+" - "+actSuperClassName);
            }
        }
    }
}

//check superclasses for all enumerations. Add these enumerations as subclasses for the parent class/enumeration
function inheritance_enumerations() {
    let keyArray = Object.keys(memory_enumerations);
    for (let i = 0; i < keyArray.length; i++) {
        let actSubClass =  memory_enumerations[keyArray[i]];
        for (let j = 0; j < actSubClass["superClasses"].length; j++) {
            let actSuperClassName = actSubClass["superClasses"][j];
            if(!check_isUndefined(memory_classes[actSuperClassName])){
                //add only if class is available
                memory_classes[actSuperClassName]["subClasses"].push(actSubClass.name);
            } else if(!check_isUndefined(memory_enumerations[actSuperClassName])){
                //add only if enumeration is available
                memory_enumerations[actSuperClassName]["subClasses"].push(actSubClass.name);
            } else {
                //superclass is not in classes memory nor in enumerations memory
                errors.push({
                    "message": "Enumeration has a superClass which is not in classes memory nor in enumerations memory.",
                    "payload": actSubClass
                });
                print("d"," inheritance_enumerations "+JSON.stringify(actSubClass.name)+" - "+actSuperClassName);
            }
        }
    }
}

//check superclasses for all dataTypes and add these dataTypes as subclasses for the parent dataTypes
function inheritance_dataTypes() {
    let keyArray = Object.keys(memory_dataTypes);
    for (let i = 0; i < keyArray.length; i++) {
        let actDataType =  memory_dataTypes[keyArray[i]];
        for (let j = 0; j < actDataType["superClasses"].length; j++) {
            let actSuperClassName = actDataType["superClasses"][j];
            if(!check_isUndefined(memory_dataTypes[actSuperClassName])){
                //add only if class is available
                memory_dataTypes[actSuperClassName]["subClasses"].push(actDataType.name);
            } else {
                //superclass is not in dataTypes memory
                errors.push({
                    "message": "DataType has a superClass which is not in dataTypes memory.",
                    "payload": actDataType
                });
                print("d"," inheritance_dataTypes "+JSON.stringify(actDataType.name)+" - "+actSuperClassName);
            }
        }
    }
}

//check superProperties for all properties and add these properties as subProperties for the parent properties
function inheritance_properties() {
    let keyArray = Object.keys(memory_properties);
    for (let i = 0; i < keyArray.length; i++) {
        let actProperty =  memory_properties[keyArray[i]];
        for (let j = 0; j < actProperty["superProperties"].length; j++) {
            let actSuperPropertyName = actProperty["superProperties"][j];
            if(!check_isUndefined(memory_properties[actSuperPropertyName])){
                //add only if class is available
                memory_properties[actSuperPropertyName]["subProperties"].push(actProperty.name);
            } else {
                //superProperty is not in properties memory
                errors.push({
                    "message": "Property has a superProperty which is not in properties memory.",
                    "payload": actProperty
                });
                print("d"," inheritance_properties "+JSON.stringify(actProperty.name)+" - "+actSuperPropertyName);
            }
        }
    }
}

//check relationships for classes. Add properties fields
function relationships_classes() {
    //part 1: create properties field for classes
    let keyArray1 = Object.keys(memory_classes);
    for (let i = 0; i < keyArray1.length; i++) {
        memory_classes[keyArray1[i]]["properties"] = [];
    }
}

//check relationships for enumerations. Add values to enumerationMembers field. Add properties field
function relationships_enumerations() {
    let keyArray = Object.keys(memory_enumerationMembers);
    for (let i = 0; i < keyArray.length; i++) {
        //check the domain enumerations for all enumerationMembers
        let actEnumerationMember =  memory_enumerationMembers[keyArray[i]];
        if(!check_isUndefined(memory_enumerations[actEnumerationMember.domainEnumeration])){
            //add only if class is available
            memory_enumerations[actEnumerationMember.domainEnumeration]["enumerationMembers"].push(keyArray[i]);
        } else {
            //there is no enumeration with this name
            errors.push({
                "message": "EnumerationMember has a domain which is not in enumeration memory",
                "payload": actEnumerationMember
            });
            //print("d"," relationships_enumerations "+JSON.stringify(actEnumerationMember.name)+" - "+actEnumerationMember.domainEnumeration);
        }
    }
    keyArray = Object.keys(memory_enumerations);
    for (let i = 0; i < keyArray.length; i++) {
        //add properties field for enumerations
        memory_enumerations[keyArray[i]]["properties"] = [];
    }
}

//check relationships for properties. Add properties to their domains.
function relationships_fillProperties() {
    //part 2: fill properties field
    let keyArray = Object.keys(memory_properties);
    for (let i = 0; i < keyArray.length; i++) {
        //check the domainClasses for all properties
        let actProperty =  memory_properties[keyArray[i]];
        for (let j = 0; j < actProperty["domainClasses"].length; j++) {
            let actDomainName = actProperty["domainClasses"][j];
            if(!check_isUndefined(memory_classes[actDomainName])){
                //add only if class is available
                memory_classes[actDomainName]["properties"].push(keyArray[i]);
            } else if(!check_isUndefined(memory_enumerations[actDomainName])){
                //add only if class is available
                memory_enumerations[actDomainName]["properties"].push(keyArray[i]);
            } else {
                //there is no class with this name
                errors.push({
                    "message": "Property has a domain which is not in classes memory",
                    "payload": actProperty
                });
                //print("d"," relationships_classes "+JSON.stringify(actProperty.name)+" - "+actDomainName);
            }
        }
    }
}

//create the output data for the output file "sdo_classes.json"
function outputCreate_classes(){
    //this function can be seen as an template if there may be a need to rearrange/rename data fields
    let keyArray = Object.keys(memory_classes);
    for (let i = 0; i < keyArray.length; i++) {
        outputData_classes[keyArray[i]] = memory_classes[keyArray[i]];
    }
}

//create the output data for the output file "sdo_properties.json"
function outputCreate_properties(){
    //this function can be seen as an template if there may be a need to rearrange/rename data fields
    let keyArray = Object.keys(memory_properties);
    for (let i = 0; i < keyArray.length; i++) {
        outputData_properties[keyArray[i]] = memory_properties[keyArray[i]];
    }
}

//create the output data for the output file "sdo_dataTypes.json"
function outputCreate_dataTypes(){
    //this function can be seen as an template if there may be a need to rearrange/rename data fields
    let keyArray = Object.keys(memory_dataTypes);
    for (let i = 0; i < keyArray.length; i++) {
        outputData_dataTypes[keyArray[i]] = memory_dataTypes[keyArray[i]];
    }
}

//create the output data for the output file "sdo_enumerations.json"
function outputCreate_enumerations(){
    //this function can be seen as an template if there may be a need to rearrange/rename data fields
    let keyArray = Object.keys(memory_enumerations);
    for (let i = 0; i < keyArray.length; i++) {
        outputData_enumerations[keyArray[i]] = memory_enumerations[keyArray[i]];
    }
}

//create the output data for the output file "sdo_enumerationMembers.json"
function outputCreate_enumerationMembers(){
    //this function can be seen as an template if there may be a need to rearrange/rename data fields
    let keyArray = Object.keys(memory_enumerationMembers);
    for (let i = 0; i < keyArray.length; i++) {
        outputData_enumerationMembers[keyArray[i]] = memory_enumerationMembers[keyArray[i]];
    }
}

//create the output data for the output file "sdo_classesMaterialized.json"
function outputCreate_classesMaterialized(){
    //add classes
    let keyArray = Object.keys(memory_classes);
    for (let i = 0; i < keyArray.length; i++) {
        outputData_classesMaterialized[keyArray[i]] = cloneJSON(memory_classes[keyArray[i]]);
    }
    //add enumerations
    keyArray = Object.keys(memory_enumerations);
    for (let i = 0; i < keyArray.length; i++) {
        outputData_classesMaterialized[keyArray[i]] = cloneJSON(memory_enumerations[keyArray[i]]);
    }
    //add dataTypes
    keyArray = Object.keys(memory_dataTypes);
    for (let i = 0; i < keyArray.length; i++) {
        outputData_classesMaterialized[keyArray[i]] = cloneJSON(memory_dataTypes[keyArray[i]]);
    }
    //inheritance of properties from superclasses
    keyArray = Object.keys(outputData_classesMaterialized);
    for (let i = 0; i < keyArray.length; i++) {
        if( outputData_classesMaterialized[keyArray[i]].type === "Class" || outputData_classesMaterialized[keyArray[i]].type === "Enumeration"){
            let properties =   outputData_classesMaterialized[keyArray[i]].properties;
            let superClasses = outputData_classesMaterialized[keyArray[i]].superClasses;
            outputData_classesMaterialized[keyArray[i]].properties = uniquifyArray(rec_retrievePropertiesOfParents(superClasses, properties));
        }
    }
    //materialize properties
    keyArray = Object.keys(outputData_classesMaterialized);
    for (let i = 0; i < keyArray.length; i++) {
        if( outputData_classesMaterialized[keyArray[i]].type === "Class" || outputData_classesMaterialized[keyArray[i]].type === "Enumeration"){
            let properties =   outputData_classesMaterialized[keyArray[i]].properties;
            let materializedProperties = [];
            for (let j = 0; j < properties.length; j++) {
                materializedProperties.push(memory_properties[properties[j]]);
            }
            outputData_classesMaterialized[keyArray[i]].properties = materializedProperties;
        }
    }
    //materialize enumerationMembers
    keyArray = Object.keys(outputData_classesMaterialized);
    for (let i = 0; i < keyArray.length; i++) {
        if(outputData_classesMaterialized[keyArray[i]].type === "Enumeration"){
            let enumerationMembers = outputData_classesMaterialized[keyArray[i]].enumerationMembers;
            let materializedEnumerationMembers = [];
            for (let j = 0; j < enumerationMembers.length; j++) {
                materializedEnumerationMembers.push(memory_enumerationMembers[enumerationMembers[j]]);
            }
            outputData_classesMaterialized[keyArray[i]].enumerationMembers = materializedEnumerationMembers;
        }
    }
}

//recursive function which retrieves the properties of all superClasses of a Class/DataType/Enumeration
//superClasses and resultContainer are Arrays
function rec_retrievePropertiesOfParents(superClasses, resultContainer) {
    if(superClasses.length === 0){
        return resultContainer;
    }
    for(let i=0;i<superClasses.length;i++){
        let actSuperClass = outputData_classesMaterialized[superClasses[i]];
        if(actSuperClass !== undefined){
            //add properties of superclass
            if(check_isArray(actSuperClass.properties)){
                if(actSuperClass.length !== 0){
                    resultContainer.push.apply(resultContainer, actSuperClass.properties);
                }
            }
            //add properties of superclasses of superclass (recursive)
            rec_retrievePropertiesOfParents(actSuperClass.superClasses, resultContainer)
        } else {
            errors.push({
                "message": "Entry in outputData_classesMaterialized has a superClass which is not in the set.",
                "payload": superClasses[i]
            });
            console.log("d","rec_retrievePropertiesOfParents "+superClasses[i]);
        }
    }
    return resultContainer;
}

//export the output data files
function exportOutputFiles(){
    writeDataInLocalFile("sdo_classes.json",stringifyJSON(outputData_classes));
    writeDataInLocalFile("sdo_properties.json",stringifyJSON(outputData_properties));
    writeDataInLocalFile("sdo_dataTypes.json",stringifyJSON(outputData_dataTypes));
    writeDataInLocalFile("sdo_enumerations.json",stringifyJSON(outputData_enumerations));
    writeDataInLocalFile("sdo_enumerationMembers.json",stringifyJSON(outputData_enumerationMembers));
    writeDataInLocalFile("sdo_classesMaterialized.json",stringifyJSON(outputData_classesMaterialized));
}

//export a minified version of the output data files
function exportMinifiedOutputFiles() {
    writeDataInLocalFile("sdo_classes.min.json",JSON.stringify(outputData_classes, null, 0));
    writeDataInLocalFile("sdo_properties.min.json",JSON.stringify(outputData_properties, null, 0));
    writeDataInLocalFile("sdo_dataTypes.min.json",JSON.stringify(outputData_dataTypes, null, 0));
    writeDataInLocalFile("sdo_enumerations.min.json",JSON.stringify(outputData_enumerations, null, 0));
    writeDataInLocalFile("sdo_enumerationMembers.min.json",JSON.stringify(outputData_enumerationMembers, null, 0));
    writeDataInLocalFile("sdo_classesMaterialized.min.json",JSON.stringify(outputData_classesMaterialized, null, 0));
}

//export the error files
function exportErrorFiles(){
    writeDataInLocalFile("ErrorLog.txt","Amount of Errors: "+errors.length+"\n\n"+stringifyJSON(errors));
}

//export the meta data as file
function exportMetaFiles() {
    let outputString = "";
    outputString = outputString.concat("Amount of @graph nodes: "+inputDataRows.length);
    outputString = outputString.concat("\nAmount of @graph nodes with errors: "+COUNTER_DATAROW_ERROR);

    outputString = outputString.concat("\n\nAmount of Classes: "+Object.keys(memory_classes).length);
    outputString = outputString.concat("\nAmount of Properties: "+Object.keys(memory_properties).length);
    outputString = outputString.concat("\nAmount of DataTypes: "+Object.keys(memory_dataTypes).length);
    outputString = outputString.concat("\nAmount of Enumerations: "+Object.keys(memory_enumerations).length);
    outputString = outputString.concat("\nAmount of EnumerationMembers: "+Object.keys(memory_enumerationMembers).length);

    outputString = outputString.concat("\n\nAmount of Classes (including Enumerations) superseded: "+COUNTER_DATAROW_CLASS_SUPERSEDED);
    outputString = outputString.concat("\nAmount of Properties superseded: "+COUNTER_DATAROW_PROPERTY_SUPERSEDED);
    outputString = outputString.concat("\nAmount of DataTypes superseded: "+COUNTER_DATAROW_DATATYPE_SUPERSEDED);
    outputString = outputString.concat("\nAmount of EnumerationMembers superseded: "+COUNTER_DATAROW_ENUMERATIONMEMBER_SUPERSEDED);

    writeDataInLocalFile("Log.txt",outputString);
}


/*
 ===============
 Helper functions
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
function cloneJSON(json){
    return JSON.parse(JSON.stringify(json));
}

/*
 ===============
 Debug functions
 ===============
 */

function outputMemory() {
    writeDataInLocalFile("memory_classes.json",stringifyJSON(memory_classes));
    writeDataInLocalFile("memory_properties.json",stringifyJSON(memory_properties));
    writeDataInLocalFile("memory_dataTypes.json",stringifyJSON(memory_dataTypes));
    writeDataInLocalFile("memory_enumerations.json",stringifyJSON(memory_enumerations));
    writeDataInLocalFile("memory_enumerationMembers.json",stringifyJSON(memory_enumerationMembers));
}
function printOccurrencesNumberOfPropertyOfArray(array,property) {
    let resultArr = {};
    for(let i=0;i<array.length;i++){
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
    for(let i=0;i<array.length;i++){
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