"use strict";
const policy=require('./launch-policy.json');
function allowed(scope){return Object.hasOwn(policy,scope)&&policy[scope]===true;}
function stopCli(scope){if(allowed(scope))return false;console.log('Veilig gestopt: juridische controle ontbreekt voor '+scope+'. Zie Veldio-25-lanceercontrole.md.');return true;}
module.exports={allowed,stopCli};
