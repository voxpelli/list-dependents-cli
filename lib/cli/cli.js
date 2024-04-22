import chalk from 'chalk';
import { messageWithCauses, stackWithCauses } from 'pony-cause';

import { peowlyCommands } from 'peowly-commands';

import * as cliCommands from './commands/index.js';
import { InputError, isErrorWithCode } from './utils.js';

export async function cli () {
  try {
    await peowlyCommands(cliCommands, { importMeta: import.meta });
  } catch (err) {
    /** @type {string|undefined} */
    let errorTitle;
    /** @type {string} */
    let errorMessage = '';
    /** @type {string|undefined} */
    let errorBody;

    if (err instanceof InputError) {
      errorTitle = 'Invalid input';
      errorMessage = err.message;
      errorBody = err.body;
    } else if (isErrorWithCode(err) && (err.code === 'ERR_PARSE_ARGS_UNKNOWN_OPTION' || err.code === 'ERR_PARSE_ARGS_INVALID_OPTION_VALUE')) {
      errorTitle = 'Invalid input';
      errorMessage = err.message;
    }

    if (!errorTitle) {
      if (err instanceof Error) {
        errorTitle = 'Unexpected error';
        errorMessage = messageWithCauses(err);
        errorBody = stackWithCauses(err);
      } else {
        errorTitle = 'Unexpected error with no details';
      }
    }

    // eslint-disable-next-line no-console
    console.error(`${chalk.white.bgRed(errorTitle + ':')} ${errorMessage}`);
    if (errorBody) {
      // eslint-disable-next-line no-console
      console.error('\n' + errorBody);
    }

    // eslint-disable-next-line unicorn/no-process-exit
    process.exit(1);
  }
}
