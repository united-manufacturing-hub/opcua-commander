
import envPaths from "env-paths";
import { OPCUACertificateManager } from "node-opcua-certificate-manager";
import * as fs from "fs";
import * as path from "path";

const paths = envPaths("opcua-commander");

export async function makeCertificate() {

    const configFolder = paths.config;

    const pkiFolder = path.join(configFolder, "pki");
    const certificateManager = new OPCUACertificateManager({
        rootFolder: pkiFolder
    });

    console.log("PKI Folder = ", pkiFolder);

    const clientCertificateManager = new OPCUACertificateManager({
        rootFolder: pkiFolder,
        automaticallyAcceptUnknownCertificate: true,
        name: "pki"
    });

    await clientCertificateManager.initialize();

    const certificateFile = path.join(pkiFolder, "opcua_commander_certificate.pem");
    const privateKeyFile = clientCertificateManager.privateKey;
    if (!fs.existsSync(privateKeyFile)) {
        throw new Error("Cannot find privateKeyFile " + privateKeyFile);
    }
    if (!fs.existsSync(certificateFile)) {

        await certificateManager.createSelfSignedCertificate({
            applicationUri: "OPCUA-COMMANDER",
            outputFile: certificateFile,
            subject: "/CN=Sterfive.com;/L=France",
            dns: [],
            // ip: [],
            startDate: new Date(),
            validity: 365 * 10,
        });
    }

    return { certificateFile, privateKeyFile };
}