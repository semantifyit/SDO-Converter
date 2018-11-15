var sdoLibrary = new function () {

    /*memory data*/
    this.memory_classes = null;            //classes without enumerations, enumeration instances and dataTypes
    this.memory_properties = null;         //properties
    this.memory_dataTypes = null;          //dataType classes
    this.memory_enumerations = null;       //enumeration classes
    this.memory_enumerationMembers = null; //enumeration instances
    this.memory_classesMaterialized = null; // materialized view of classes, dataTypes and enumerations

    /*setter and init processes*/
    this.setVersion = function (version) {
        try {
            this.recursive_loadSDOFiles(version, 0);
        } catch (e) {
            console.log(e);
            console.log("could not find data for the specified version " + version)
        }
    };

    //process which loads the SDO files and starts the materialization
    this.recursive_loadSDOFiles = function (version, filePosition) {
        if (sdoDataFiles.length > filePosition) {
            var actualData = sdoDataFiles[filePosition];
            loadJSON("data_output/" + version + "/" + actualData.fileName, function (json) {
                try {
                    json = JSON.parse(json);
                } catch (e) {
                    console.log("could not load JSON file, seems not to be valid json.")
                }
                sdoLibrary.set_memory_data(actualData.memoryName, json);
                sdoLibrary.recursive_loadSDOFiles(version, filePosition + 1);
            });
        } else {
            //materialize classes
            this.materialize_classesMaterialized();
            //callback function
            callbackAfterLoading();
        }
    };

    //set the data for a specific sdo artifact
    this.set_memory_data = function (memoryName, data) {
        // console.log(data);
        if (data === null || data === undefined || data.constructor === "test".constructor || data.constructor === [].constructor) {
            throw new Error('The data provided for "' + memoryName + '" must be a valid JSON Object.');
        }
        this[memoryName] = data;
        return true;
    };

    //create the output data for the output file "sdo_classesMaterialized.json"
    this.materialize_classesMaterialized = function () {
        //check if memory has been initialized
        if (this.memory_classes === null || this.memory_properties === null || this.memory_dataTypes === null || this.memory_enumerations === null || this.memory_enumerationMembers === null) {
            throw new Error('Not all memory items for materialization process have been initialized. You have to set the all the memory data first: set_memory_data(memoryName, data)');
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
            if (this.memory_classesMaterialized[keyArray[i]].type === "Class" || this.memory_classesMaterialized[keyArray[i]].type === "Enumeration") {
                var properties = this.memory_classesMaterialized[keyArray[i]].properties;
                var superClasses = this.memory_classesMaterialized[keyArray[i]].superClasses;
                this.memory_classesMaterialized[keyArray[i]].properties = uniquifyArray(this.rec_retrievePropertiesOfParents(superClasses, properties));
            }
        }
        //materialize properties
        keyArray = Object.keys(this.memory_classesMaterialized);
        for (var i = 0; i < keyArray.length; i++) {
            if (this.memory_classesMaterialized[keyArray[i]].type === "Class" || this.memory_classesMaterialized[keyArray[i]].type === "Enumeration") {
                var properties = this.memory_classesMaterialized[keyArray[i]].properties;
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
            if (this.memory_classesMaterialized[keyArray[i]].type === "Enumeration") {
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
    this.rec_retrievePropertiesOfParents = function (superClasses, resultContainer) {
        if (superClasses.length === 0) {
            return resultContainer;
        }
        for (var i = 0; i < superClasses.length; i++) {
            var actSuperClass = this.memory_classesMaterialized[superClasses[i]];
            if (actSuperClass !== undefined) {
                //add properties of superclass
                if (check_isArray(actSuperClass.properties)) {
                    if (actSuperClass.length !== 0) {
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
    function cloneJSON(json) {
        return JSON.parse(JSON.stringify(json));
    }

    //checks if a given object is an array
    function check_isArray(object) {
        return Array.isArray(object);
    }

    //compares the values of an array an removes duplicates
    function uniquifyArray(array) {
        var seen = {};
        var result = [];
        for (var i = 0; i < array.length; i++) {
            var item = array[i];
            if (seen[item] !== 1) {
                seen[item] = 1;
                result.push(item);
            }
        }
        return result;
    }

    /*non-materialized data retrieval functions*/
    //retrieve a non-materialized class
    this.get_class = function (className) {
        //check if memory has been initialized
        if (this.memory_classes === null) {
            throw new Error('memory_classes has not been initialized. You have to set the the memory data first: set_memory_data("memory_classes", data)');
        }
        var classObj = this.memory_classes[className];
        //check if property exists
        if (classObj === undefined) {
            throw new Error('There is no class with name "' + className + '" in the memory.');
        }
        return classObj;
    };
    //retrieve all non-materialized classes
    this.get_allClasses = function () {
        //check if memory has been initialized
        if (this.memory_classes === null) {
            throw new Error('memory_classes has not been initialized. You have to set the the memory data first: set_memory_data("memory_classes", data)');
        }
        return this.memory_classes;
    };
    //retrieve a non-materialized property
    this.get_property = function (propertyName) {
        //check if memory has been initialized
        if (this.memory_properties === null) {
            throw new Error('memory_properties has not been initialized. You have to set the the memory data first: set_memory_data("memory_properties", data)');
        }
        var propertyObj = this.memory_properties[propertyName];
        //check if property exists
        if (propertyObj === undefined) {
            throw new Error('There is no property with name "' + propertyName + '" in the memory.');
        }
        return propertyObj;
    };
    //retrieve all non-materialized properties
    this.get_allProperties = function () {
        //check if memory has been initialized
        if (this.memory_properties === null) {
            throw new Error('memory_properties has not been initialized. You have to set the the memory data first: set_memory_data("memory_properties", data)');
        }
        return this.memory_properties;
    };
    //retrieve a non-materialized dataType
    this.get_dataType = function (dataTypeName) {
        //check if memory has been initialized
        if (this.memory_dataTypes === null) {
            throw new Error('memory_dataTypes has not been initialized. You have to set the the memory data first: set_memory_data("memory_dataTypes", data)');
        }
        var dataTypeObj = this.memory_dataTypes[dataTypeName];
        //check if property exists
        if (dataTypeObj === undefined) {
            throw new Error('There is no dataType with name "' + dataTypeName + '" in the memory.');
        }
        return dataTypeObj;
    };
    //retrieve all non-materialized dataTypes
    this.get_allDataTypes = function () {
        //check if memory has been initialized
        if (this.memory_dataTypes === null) {
            throw new Error('memory_dataTypes has not been initialized. You have to set the the memory data first: set_memory_data("memory_dataTypes", data)');
        }
        return this.memory_dataTypes;
    };
    //retrieve a non-materialized enumeration
    this.get_enumeration = function (enumerationName) {
        //check if memory has been initialized
        if (this.memory_enumerations === null) {
            throw new Error('memory_enumerations has not been initialized. You have to set the the memory data first: set_memory_data("memory_enumerations", data)');
        }
        var enumerationObj = this.memory_enumerations[enumerationName];
        //check if property exists
        if (enumerationObj === undefined) {
            throw new Error('There is no enumeration with name "' + enumerationName + '" in the memory.');
        }
        return enumerationObj;
    };
    //retrieve all non-materialized enumerations
    this.get_allEnumerations = function () {
        //check if memory has been initialized
        if (this.memory_enumerations === null) {
            throw new Error('memory_enumerations has not been initialized. You have to set the the memory data first: set_memory_data("memory_enumerations", data)');
        }
        return this.memory_enumerations;
    };
    //retrieve a non-materialized enumerationMember
    this.get_enumerationMember = function (enumerationMemberName) {
        //check if memory has been initialized
        if (this.memory_enumerationMembers === null) {
            throw new Error('memory_enumerationMembers has not been initialized. You have to set the the memory data first: set_memory_data("memory_enumerationMembers", data)');
        }
        var enumerationMemberObj = this.memory_enumerationMembers[enumerationMemberName];
        //check if property exists
        if (enumerationMemberObj === undefined) {
            throw new Error('There is no enumerationMember with name "' + enumerationMemberName + '" in the memory.');
        }
        return enumerationMemberObj;
    };
    //retrieve all non-materialized enumerationMembers
    this.get_allEnumerationMembers = function () {
        //check if memory has been initialized
        if (this.memory_enumerationMembers === null) {
            throw new Error('memory_enumerationMembers has not been initialized. You have to set the the memory data first: set_memory_data("memory_enumerationMembers", data)');
        }
        return this.memory_enumerationMembers;
    };

    /*materialized data retrieval functions*/
    //retrieve a non-materialized class
    this.get_classMaterialized = function (className) {
        //check if memory has been initialized
        if (this.memory_classesMaterialized === null) {
            throw new Error('memory_classesMaterialized has not been initialized. Use the function materialize_classesMaterialized() to initiate.');
        }
        var classObj = this.memory_classesMaterialized[className];
        //check if property exists
        if (classObj === undefined) {
            throw new Error('There is no materialized class with name "' + className + '" in the memory.');
        }
        return classObj;
    };
    //retrieve all non-materialized classes
    this.get_allClassesMaterialized = function () {
        //check if memory has been initialized
        if (this.memory_classesMaterialized === null) {
            throw new Error('memory_classesMaterialized has not been initialized. Use the function materialize_classesMaterialized() to initiate.');
        }
        return this.memory_classesMaterialized;
    };
};

function loadJSON(path, callback) {
    var xobj = new XMLHttpRequest();
    xobj.overrideMimeType("application/json");
    xobj.open('GET', path, true);
    xobj.onreadystatechange = function () {
        if (xobj.readyState == 4 && xobj.status == "200") {
            // Required use of an anonymous callback as .open will NOT return a value but simply returns undefined in asynchronous mode
            callback(xobj.responseText);
        }
    };
    xobj.send(null);
}


//SDO files to load
var sdoDataFiles = [
    {
        fileName: 'sdo_classes.json',
        memoryName: 'memory_classes'
    },
    {
        fileName: 'sdo_properties.json',
        memoryName: 'memory_properties'
    },
    {
        fileName: 'sdo_dataTypes.json',
        memoryName: 'memory_dataTypes'
    },
    {
        fileName: 'sdo_enumerations.json',
        memoryName: 'memory_enumerations'
    },
    {
        fileName: 'sdo_enumerationMembers.json',
        memoryName: 'memory_enumerationMembers'
    }
];

//Callback function called after the loading of data required for the "setVersion" function is done
//May be used to get an async workflow based on the "ES5 callback hell"
function callbackAfterLoading() {
    console.log("Loading of sdoLibrary_node finished.");
}

// Exports the sdoLibrary_node singleton as a global object in the browser (the window context)
window.sdoLibrary = sdoLibrary;