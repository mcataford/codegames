import {
    collectBranch,
    getIssueComment,
    readJSON,
    shellExec,
    upsertIssueComment,
    writeJSON,
} from './utils'
import { Context, RunnableConfig } from './types'

const GAME_ROOT = './branches/game'
const P1_ROOT = '.'
const P2_ROOT = './branches/player2'

/*
 * formatObjectForCLI is a dirty hack to work around JSON.stringify
 * and exec not playing nice together. It ensures that the data
 * can be correctly serialized/deserialized as JSON and passed
 * as a command-line argument to the different actors.
 */
function formatObjectForCLI(obj: object): string {
    return Buffer.from(JSON.stringify(obj)).toString('base64')
}

/*
 * run implements the game loop and manages the higher-level state of
 * the game.
 */
async function run(challengeContextPath: any) {
    const context = await readJSON<Context>(challengeContextPath)

    await Promise.all([
        collectBranch(context.runnerBranch, GAME_ROOT),
        collectBranch(context.challengeeBranch, P2_ROOT),
    ])

    const [p1Config, p2Config] = await Promise.all([
        readJSON<RunnableConfig>(`${P1_ROOT}/player.config.json`),
        readJSON<RunnableConfig>(`${P2_ROOT}/player.config.json`),
    ])

    const preFetchStatusUpdate = await getIssueComment(context)

    const fetchStatusUpdate = `${preFetchStatusUpdate}\n:ballot_box_with_check: Fetch players and game`

    await upsertIssueComment(
        context.repoOwner,
        context.repoName.context.pullNumber,
        fetchStatusUpdate,
        context.commentId,
    )
    /*
     * The runner state is a combination of private and public data.
     */
    const runnerState = {
        turn: 0,
        winner: null,
        outcome: null,
        isDone: false,
        gameData: { decision: null },
        gameSecrets: {},
    }

    /*
     * The runner gets the run once without a move. This allows
     * for initial state setup.
     */

    const runnerOutput = await shellExec(
        `${context.gameDetails.runnerType} ${context.gameDetails.path}`,
    )

    const parsedInitRunnerOut = JSON.parse(runnerOutput.stdout)

    runnerState.gameSecrets = parsedInitRunnerOut.gameSecrets ?? {}
    runnerState.gameData = parsedInitRunnerOut.gameData ?? {}

    while (!runnerState.isDone) {
        /*
         * Each turn starts with the selection of who plays, alternating
         * between the two active players. The active player gets to
         * make a move against the current public game state and emit
         * a JSON-compliant blob to STDOUT (the "move").
         *
         * The move is fed to the game runtime alongside the public state and
         * secret state. The game runtime is responsible for updating the
         * game state accordingly and returning it to this process via
         * STDOUT.
         *
         * The game ends once the runner sets the "isDone" marker
         * in runner state.
         */
        runnerState.turn += 1
        const playerConfig = runnerState.turn % 2 ? p1Config : p2Config
        const playerName =
            runnerState.turn % 2 ? context.challenger : context.challengee

        console.group(`Turn ${runnerState.turn}: ${playerName} plays`)

        const turnOutput = await shellExec(
            `${playerConfig.runnerType} ${playerConfig.runnerPath}`,
        )

        console.log(`Active player: ${p1Config.runnerPath}`)
        console.log(`Turn output: ${turnOutput.stdout}`)

        const runnerOutput = await shellExec(
            `${context.gameDetails.runnerType} ${
                context.gameDetails.path
            } ${formatObjectForCLI(
                runnerState.gameSecrets,
            )} ${formatObjectForCLI(runnerState.gameData)} ${formatObjectForCLI(
                JSON.parse(turnOutput.stdout),
            )}`,
        )

        const parsedRunnerOut = JSON.parse(runnerOutput.stdout)

        runnerState.gameSecrets = {
            ...runnerState.gameSecrets,
            ...(parsedRunnerOut.gameSecrets ?? {}),
        }
        runnerState.gameData = {
            ...runnerState.gameData,
            ...(parsedRunnerOut.gameData ?? {}),
        }

        runnerState.isDone = parsedRunnerOut.done
        runnerState.outcome = runnerState.gameData.decision

        console.log(`New game state: ${JSON.stringify(runnerState.gameData)}`)
        console.groupEnd()
    }

    let winner

    if (runnerState.outcome !== 'draw')
        winner =
            runnerState.turn % 2 && runnerState.outcome === 'win'
                ? context.challenger
                : context.challengee

    const summary = {
        turnsPlayed: runnerState.turn,
        outcome: runnerState.outcome,
        winner,
    }

    const outcomeMessage = winner
        ? `:tada::tada: ${winner} wins this round! :tada::tada:`
        : ":sweat_smile: Womp womp. It's a draw!"

    const preSummaryStatusUpdate = await getIssueComment(context)

    const summaryStatusUpdate = `${preSummaryStatusUpdate}\n:ballot_box_with_check: Run game\n## Game summary\n### ${outcomeMessage}\n\`\`\`\nTurns played: ${summary.turnsPlayed}\n\`\`\``

    await upsertIssueComment(
        context.repoOwner,
        context.repoName.context.pullNumber,
        summaryStatusUpdate,
        context.commentId,
    )

    await writeJSON('./summary.json', summary)
}

/*
 * The runner is called with the root paths to the game runtime and each
 * of the players. Their individual configurations should container all we need.
 */
const [, , challengePath] = process.argv

run(challengePath).catch((e: Error) => {
    console.error(`The game crashed unexpectedly. (err: ${e})`)
    console.error(e)
    process.exit(1)
})
