"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
// Test importing and running the zero knowledge verification
require("react-native-get-random-values");
async function testVerificationImport() {
    try {
        console.log('🔍 Testing Zero Knowledge Verification Import...');
        // Try to import the verification system
        const { ZeroKnowledgeVerification } = await Promise.resolve().then(() => __importStar(require('./src/utils/zeroKnowledgeVerification')));
        console.log('✅ Successfully imported ZeroKnowledgeVerification class');
        // Test that we can call the quick verify method
        console.log('🔍 Testing quick verification method...');
        const result = await ZeroKnowledgeVerification.quickVerify();
        console.log(`✅ Quick verification completed: ${result}`);
        return true;
    }
    catch (error) {
        console.error('❌ Error testing verification system:', error);
        if (error instanceof SyntaxError) {
            console.error('❌ SYNTAX ERROR - this indicates the file still has parsing issues');
        }
        return false;
    }
}
// Run the test
testVerificationImport().then(success => {
    console.log(`\n${success ? '✅' : '❌'} Verification system ${success ? 'works correctly' : 'has issues'}`);
}).catch(error => {
    console.error('❌ Test failed:', error);
});
