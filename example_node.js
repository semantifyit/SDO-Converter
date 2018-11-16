sdoLibrary = require("./sdoLibrary_node.js");

// Set Schema.org version of library to 3.3
sdoLibrary.setVersion("3.3");

// get property "bccRecipient"
let exampleProperty = sdoLibrary.get_property("bccRecipient");
console.log("Property 'bccRecipient':");
console.log(JSON.stringify(exampleProperty,null,2));

// Set Schema.org version of library to latest
sdoLibrary.setVersion("latest");

// get class "Person" (does NOT include properties of super-classes, e.g. "name" which is from the super-class "Thing")
let exampleClass = sdoLibrary.get_class("Person");
console.log("Class 'Person':");
console.log(JSON.stringify(exampleClass,null,2));

// get materialized class "Person" (does include all properties from super-classes)
let exampleClassMaterialized = sdoLibrary.get_classMaterialized("Person");
console.log("Materialized Class 'Person':");
console.log(JSON.stringify(exampleClassMaterialized,null,2));