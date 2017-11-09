/*
How to use this library:
Load the (non-materialized) sdo data files.
Load this js file.
Use the functions "sdoConverter.set_memory_data()" to save all your loaded sdo files in the memory of this lib.
Now you can use functions for non-materialized data like "sdoConverter.get_property(name)" or "sdoConverter.get_allProperties()".
(Optional) Use the function "sdoConverter.materialize_classesMaterialized()".
(Optional) Now you can use functions for materialized data like "sdoConverter.get_classMaterialized(Hotel)".

example node.js:
require('../data/sdo-converter-lib.js')();
sdoConverter.set_memory_data('memory_classes', require('../data/sdo_classes.json'));
sdoConverter.set_memory_data('memory_properties', require('../data/sdo_properties.json'));
sdoConverter.set_memory_data('memory_dataTypes', require('../data/sdo_dataTypes.json'));
sdoConverter.set_memory_data('memory_enumerations', require('../data/sdo_enumerations.json'));
sdoConverter.set_memory_data('memory_enumerationMembers', require('../data/sdo_enumerationMembers.json'));
sdoConverter.materialize_classesMaterialized();
let ClassesObject = sdoConverter.get_allClassesMaterialized();

*/

//singleton Object
var sdoConverter = new function () {

    /*memory data*/
    this.memory_classes = null;            //classes without enumerations, enumeration instances and dataTypes
    this.memory_properties = null;         //properties
    this.memory_dataTypes = null;          //dataType classes
    this.memory_enumerations = null;       //enumeration classes
    this.memory_enumerationMembers = null; //enumeration instances
    this.memory_classesMaterialized = null; // materialized view of classes, dataTypes and enumerations

    /*setter and init processes*/
    //set the data for a specific sdo artifact
    this.set_memory_data = function(memoryName, data){
        this[memoryName] = data;
    };
    //create the output data for the output file "sdo_classesMaterialized.json"
    this.materialize_classesMaterialized = function(){
        //check if memory has been initialized
        if(this.memory_classes === null || this.memory_properties === null || this.memory_dataTypes === null || this.memory_enumerations === null || this.memory_enumerationMembers === null ){
            return "Error: Memory for materialization process has not been initialized."
        }
        this.memory_classesMaterialized = {};
        //add classes
        var keyArray = Object.keys(this.memory_classes);
        for (var i = 0; i < keyArray.length; i++) {
            this.memory_classesMaterialized[keyArray[i]] = cloneJSON(this.memory_classes[keyArray[i]]);
        }
        //add enumerations
        keyArray = Object.keys(this.memory_enumerations);
        for (var i = 0; i < keyArray.length; i++) {
            this.memory_classesMaterialized[keyArray[i]] = cloneJSON(this.memory_enumerations[keyArray[i]]);
        }
        //add dataTypes
        keyArray = Object.keys(this.memory_dataTypes);
        for (var i = 0; i < keyArray.length; i++) {
            this.memory_classesMaterialized[keyArray[i]] = cloneJSON(this.memory_dataTypes[keyArray[i]]);
        }
        //inheritance of properties from superclasses
        keyArray = Object.keys(this.memory_classesMaterialized);
        for (var i = 0; i < keyArray.length; i++) {
            if( this.memory_classesMaterialized[keyArray[i]].type === "Class" || this.memory_classesMaterialized[keyArray[i]].type === "Enumeration"){
                var properties =   this.memory_classesMaterialized[keyArray[i]].properties;
                var superClasses = this.memory_classesMaterialized[keyArray[i]].superClasses;
                this.memory_classesMaterialized[keyArray[i]].properties = uniquifyArray(this.rec_retrievePropertiesOfParents(superClasses, properties));
            }
        }
        //materialize properties
        keyArray = Object.keys(this.memory_classesMaterialized);
        for (var i = 0; i < keyArray.length; i++) {
            if( this.memory_classesMaterialized[keyArray[i]].type === "Class" || this.memory_classesMaterialized[keyArray[i]].type === "Enumeration"){
                var properties =   this.memory_classesMaterialized[keyArray[i]].properties;
                var materializedProperties = [];
                for (var j = 0; j < properties.length; j++) {
                    materializedProperties.push(this.memory_properties[properties[j]]);
                }
                this.memory_classesMaterialized[keyArray[i]].properties = materializedProperties;
            }
        }
        //materialize enumerationMembers
        keyArray = Object.keys(this.memory_classesMaterialized);
        for (var i = 0; i < keyArray.length; i++) {
            if(this.memory_classesMaterialized[keyArray[i]].type === "Enumeration"){
                var enumerationMembers = this.memory_classesMaterialized[keyArray[i]].enumerationMembers;
                var materializedEnumerationMembers = [];
                for (var j = 0; j < enumerationMembers.length; j++) {
                    materializedEnumerationMembers.push(this.memory_enumerationMembers[enumerationMembers[j]]);
                }
                this.memory_classesMaterialized[keyArray[i]].enumerationMembers = materializedEnumerationMembers;
            }
        }
    };

    /*helper functions*/
    //recursive function which retrieves the properties of all superClasses of a Class/DataType/Enumeration
    //superClasses and resultContainer are Arrays
    this.rec_retrievePropertiesOfParents = function(superClasses, resultContainer) {
        if(superClasses.length === 0){
            return resultContainer;
        }
        for(let i=0;i<superClasses.length;i++){
            let actSuperClass = this.memory_classesMaterialized[superClasses[i]];
            if(actSuperClass !== undefined){
                //add properties of superclass
                if(check_isArray(actSuperClass.properties)){
                    if(actSuperClass.length !== 0){
                        resultContainer.push.apply(resultContainer, actSuperClass.properties);
                    }
                }
                //add properties of superclasses of superclass (recursive)
                this.rec_retrievePropertiesOfParents(actSuperClass.superClasses, resultContainer)
            } else {
                //Entry in outputData_classesMaterialized has a superClass which is not in the set.
            }
        }
        return resultContainer;
    };
    //makes a copy of a json object
    function cloneJSON(json){
        return JSON.parse(JSON.stringify(json));
    }
    //checks if a given object is an array
    function check_isArray(object){
        return Array.isArray(object);
    }
    //compares the values of an array an removes duplicates
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

    /*non-materialized data retrieval functions*/
    //retrieve a non-materialized class
    this.get_class = function(className){
        //check if memory has been initialized
        if(this.memory_classes === null){
            return "Error: memory_classes has not been initialized."
        }
        var classObj = this.memory_classes[className];
        //check if property exists
        if(classObj === undefined){
            return "Error: There is no class with name '"+className+"' in the memory.";
        }
        return classObj;
    };
    //retrieve all non-materialized classes
    this.get_allClasses = function(){
        //check if memory has been initialized
        if(this.memory_classes === null){
            return "Error: memory_classes has not been initialized."
        }
        return this.memory_classes;
    };
    //retrieve a non-materialized property
    this.get_property = function(propertyName){
        //check if memory has been initialized
        if(this.memory_properties === null){
            return "Error: memory_properties has not been initialized."
        }
        var propertyObj = this.memory_properties[propertyName];
        //check if property exists
        if(propertyObj === undefined){
            return "Error: There is no property with name '"+propertyName+"' in the memory.";
        }
        return propertyObj;
    };
    //retrieve all non-materialized properties
    this.get_allProperties = function(){
        //check if memory has been initialized
        if(this.memory_properties === null){
            return "Error: memory_properties has not been initialized."
        }
        return this.memory_properties;
    };
    //retrieve a non-materialized dataType
    this.get_dataType = function(dataTypeName){
        //check if memory has been initialized
        if(this.memory_dataTypes === null){
            return "Error: memory_dataTypes has not been initialized."
        }
        var dataTypeObj = this.memory_dataTypes[dataTypeName];
        //check if property exists
        if(dataTypeObj === undefined){
            return "Error: There is no dataType with name '"+dataTypeName+"' in the memory.";
        }
        return dataTypeObj;
    };
    //retrieve all non-materialized dataTypes
    this.get_allDataTypes = function(){
        //check if memory has been initialized
        if(this.memory_dataTypes === null){
            return "Error: memory_dataTypes has not been initialized."
        }
        return this.memory_dataTypes;
    };
    //retrieve a non-materialized enumeration
    this.get_enumeration = function(enumerationName){
        //check if memory has been initialized
        if(this.memory_enumerations === null){
            return "Error: memory_enumerations has not been initialized."
        }
        var enumerationObj = this.memory_enumerations[enumerationName];
        //check if property exists
        if(enumerationObj === undefined){
            return "Error: There is no enumeration with name '"+enumerationName+"' in the memory.";
        }
        return enumerationObj;
    };
    //retrieve all non-materialized enumerations
    this.get_allEnumerations = function(){
        //check if memory has been initialized
        if(this.memory_enumerations === null){
            return "Error: memory_enumerations has not been initialized."
        }
        return this.memory_enumerations;
    };
    //retrieve a non-materialized enumerationMember
    this.get_enumerationMember = function(enumerationMemberName){
        //check if memory has been initialized
        if(this.memory_enumerationMembers === null){
            return "Error: memory_enumerationMembers has not been initialized."
        }
        var enumerationMemberObj = this.memory_enumerationMembers[enumerationMemberName];
        //check if property exists
        if(enumerationMemberObj === undefined){
            return "Error: There is no enumerationMember with name '"+enumerationMemberName+"' in the memory.";
        }
        return enumerationMemberObj;
    };
    //retrieve all non-materialized enumerationMembers
    this.get_allEnumerationMembers = function(){
        //check if memory has been initialized
        if(this.memory_enumerationMembers === null){
            return "Error: memory_enumerationMembers has not been initialized."
        }
        return this.memory_enumerationMembers;
    };

    /*materialized data retrieval functions*/
    //retrieve a non-materialized class
    this.get_classMaterialized = function(className){
        //check if memory has been initialized
        if(this.memory_classesMaterialized === null){
            return "Error: memory_classesMaterialized has not been initialized."
        }
        var classObj = this.memory_classesMaterialized[className];
        //check if property exists
        if(classObj === undefined){
            return "Error: There is no materialized class with name '"+className+"' in the memory.";
        }
        return classObj;
    };
    //retrieve all non-materialized classes
    this.get_allClassesMaterialized = function(){
        //check if memory has been initialized
        if(this.memory_classesMaterialized === null){
            return "Error: memory_classesMaterialized has not been initialized."
        }
        return this.memory_classesMaterialized;
    };
};
//this wrapper allows the user to use this library in a browser and in node.js
if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') {
    module.exports = function () {
        this.sdoConverter = sdoConverter;
    };
} else{
    window.sdoConverter = sdoConverter;
}