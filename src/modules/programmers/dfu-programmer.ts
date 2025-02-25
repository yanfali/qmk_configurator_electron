import * as path from 'path';
import * as childProcess from 'child_process';
const spawn = childProcess.spawn;
import prompt from 'electron-prompt';
import log from 'electron-log';
import first from 'lodash/first';

const atmelDevices: Map<number, Array<string>> = new Map([
  [12270, ['atmega8u2']],
  [12271, ['atmega16u2']],
  [12272, ['atmega32u2']],
  [12273, ['at32uc3a3']],
  [12275, ['atmega16u4']],
  [12276, ['atmega32u4']],
  [12278, ['at32uc3b0', 'at32uc3b1']],
  [12279, ['at90usb82']],
  [12280, ['at32uc3a0', 'at32uc3a1']],
  [12281, ['at90usb646']],
  [12282, ['at90usb162']],
  [12283, ['at90usb1286', 'at90usb1287']],
  [12285, ['at89c5130', 'at89c5131']],
  [12287, ['at89c5132', 'at89c5snd1c']],
]);

let dfuProgrammer: string;

if (process.platform == 'win32') {
  dfuProgrammer = path.resolve('programmers', './dfu-programmer.exe');
} else if (process.platform == 'darwin') {
  dfuProgrammer = path.resolve('programmers', './dfu-programmer');
} else {
  dfuProgrammer = 'dfu-programmer';
}
log.info('DFU programmer is', dfuProgrammer);

/**
 * Erase data from mcu
 * @return {Promise} reject - erase failed
 * @return {Promise} resolve - successfully erased mcu
 * @module programmers/dfuProgrammer
 */
function eraseChip(device: string): Promise<boolean | Error> {
  return new Promise((resolve, reject) => {
    let command = dfuProgrammer;
    let args = [device, 'erase'];
    if (process.platform === 'win32') {
      args.push('--force');
    }

    const regex = /.*Success.*\r?|\rChecking memory from .* Empty.*/;
    const eraser = spawn(command, args);
    const stderr: string[] = [];

    eraser.stderr.on('data', stderr.push);

    eraser.on('exit', (code /*, signal*/) => {
      const str = stderr.join('');
      if (
        code === 0 ||
        regex.test(str) ||
        str.includes('Chip already blank') ||
        str === ''
      ) {
        window.Bridge.statusAppend('Erase Succeeded');
        resolve(true);
      } else {
        window.Bridge.statusAppend('Erase Failed');
        window.Bridge.statusAppend(` ${str}`);
        reject(new Error('Erase Failed'));
      }
    });
  });
}

/**
 * Flash hex to mcu
 * @return {Promise} flash failed resolve or successfully flashed mcu
 * @module programmers/dfuProgrammer
 */
function flashChip(device: string): Promise<boolean | Error> {
  return new Promise((resolve, reject) => {
    const command = dfuProgrammer;
    const args = [device, 'flash', window.inputPath];
    const flasher = spawn(command, args);

    // add a linefeed to console output
    window.Bridge.statusAppend('');

    flasher.stderr.on('data', window.Bridge.statusAppendNoLF);

    flasher.on('exit', (code) => {
      if (code === 0) {
        resolve(true);
      } else {
        window.Bridge.statusAppend('Flashing Failed');
        reject(new Error('Flash Failed'));
      }
    });
  });
}

/**
 * reset chip
 * @return {Promise} reject - reset failed
 * @return {Promise} resolve - successfully reset mcu
 * @see  programmers/dfuProgrammer
 */
function resetChip(device: string): Promise<boolean | Error> {
  return new Promise((resolve, reject) => {
    const command: string = dfuProgrammer;
    const args = [device, 'reset'];
    const resetter = spawn(command, args);
    const stderr: string[] = [];

    resetter.stderr.on('data', stderr.push);
    resetter.on('exit', (code) => {
      window.Bridge.statusAppend(` ${stderr.join()}`);
      if (code === 0) {
        resolve(true);
      } else {
        window.Bridge.statusAppend('Reset Failed');
        reject(new Error('Reset Failed'));
      }
    });
  });
}

/**
 * handler
 * @param {number} productID
 * @param {string} _processor processor submitted from api
 * @module programmers/dfuProgrammer
 */
async function handler(
  productID: number,
  processor: string
): Promise<boolean | Error> {
  console.log('processor: ', processor);
  if (atmelDevices.has(productID)) {
    const searchList = atmelDevices.get(productID);
    console.log(searchList);
    const index = searchList.findIndex(
      (processorID) => processorID === processor
    );

    if (index > -1) {
      window.Bridge.statusAppend(`Found USB Device ${processor}`);
      try {
        await eraseChip(processor);
        console.log(`Erased device ${processor}`);
        await flashChip(processor);
        console.log(`Flashed device ${processor}`);
        await resetChip(processor);
        console.log(`Rebooting keyboard`);
      } catch (err) {
        window.Bridge.statusAppend(`  Error Flashing ${err}`);
        return err;
      }
      window.Bridge.statusAppend('  Successfully Flashed Keymap onto device');
    } else {
      window.Bridge.statusAppend('Please connect the Keyboard and press reset');
    }
    return true;
  }
  return false;
}

/**
 * Processing unit for flashing with dfu programmer
 * @param {number} productID usb PID for atmel device
 * @param {string} processor processor submitted from api
 * @module programmers/dfuProgrammer
 */
export function dfuProgrammerFlash(productID: number, processor: string): void {
  if (processor) {
    handler(productID, processor);
  } else {
    prompt({
      title: 'Processor',
      label: 'Please submit processor',
      height: 150,
      value: first(atmelDevices.get(productID)),
    })
      .then((r: string) => {
        if (r === null) {
          window.Bridge.statusAppend('No selection made flashing cancelled');
        } else {
          handler(productID, r);
        }
      })
      .catch(log.error);
  }
}
