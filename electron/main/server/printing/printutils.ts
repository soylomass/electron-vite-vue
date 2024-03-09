import printer from "@thiagoelg/node-printer";

export function printByteArray(printerName: string, command: Buffer) {
  return new Promise<void>((resolve, reject) => {
    printer.printDirect({
      data: command,
      printer: printerName,
      type: "RAW",
      success: (jobID) => {
        resolve();
      },
      error: (err) => {
        reject(err);
      },
    });
  });
}
