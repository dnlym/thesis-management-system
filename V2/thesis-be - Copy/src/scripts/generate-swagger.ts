import fs from 'fs';
import path from 'path';
import swaggerSpec from '../config/swagger';

const outputPath = path.resolve(__dirname, '../../swagger.json');

try {
    fs.writeFileSync(outputPath, JSON.stringify(swaggerSpec, null, 2));
    console.log(`Swagger JSON generated at: ${outputPath}`);
} catch (error) {
    console.error('Error generating Swagger JSON:', error);
    process.exit(1);
}
