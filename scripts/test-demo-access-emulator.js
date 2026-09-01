const {spawnSync} = require('child_process');

const reactScripts = require.resolve('react-scripts/bin/react-scripts.js');
const result = spawnSync(process.execPath, [
    reactScripts,
    'test',
    '--watchAll=false',
    '--runInBand',
    'src/dev-access/firebaseDemoAccess.emulator.test.js'
], {
    env: {
        ...process.env,
        CI: 'true',
        RUN_DEMO_ACCESS_EMULATOR_TESTS: 'true'
    },
    stdio: 'inherit'
});

if (result.error) {
    process.stderr.write('The demo-access emulator test could not be started.\n');
    process.exitCode = 1;
} else {
    process.exitCode = result.status === null ? 1 : result.status;
}
