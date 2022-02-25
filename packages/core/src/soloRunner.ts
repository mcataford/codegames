/*
 * The solo game runner runs the game using a single player's branch.
 * The game being run is assumed to implement single-player winning
 * conditions.
 */

import {
    collectBranch,
    getIssueComment,
    readJSON,
    runScript,
    setupTimers,
    upsertIssueComment,
} from './utils'
import {
    Context,
    GameOutcomes,
    PlayerOutput,
    RunnableConfig,
    RunnerOutput,
} from './types'
import { GAME_OUTCOME_MESSAGES } from './soloRunner.constants'

const GAME_ROOT = './branches/game'
const PLAYER_ROOT = '.'

// DEBUG gates some secrets logging.
const DEBUG_MODE = Boolean(process.env.DEBUG)

/*
 * run implements the game loop and manages the higher-level state of
 * the game.
 */
async function run(challengeContextPath: string) {
    const { addMark, timeBetween } = setupTimers()
    const context = await readJSON<Context>(challengeContextPath)

    addMark('pre-collect')
    await collectBranch(context.runnerBranch, GAME_ROOT)

    const playerConfig = await readJSON<RunnableConfig>(
        `${PLAYER_ROOT}/player.config.json`,
    )

    addMark('post-collect')
    const postFetchCode = timeBetween('pre-collect', 'post-collect')

    const preFetchStatusUpdate = await getIssueComment(context)

    const fetchStatusUpdate = `${preFetchStatusUpdate}\n:ballot_box_with_check: Fetch player and game branches (${postFetchCode}s)`

    await upsertIssueComment(
        context.repoOwner,
        context.repoName,
        context.pullNumber,
        fetchStatusUpdate,
        context.commentId,
    )
    /*
     * The runner state is a combination of private and public data.
     */
    const runnerState: {
        turn: number
        outcome: GameOutcomes
        isDone: boolean
        gameData: any
        gameSecrets: any
        playerStash: any
    } = {
        turn: 0,
        outcome: GameOutcomes.RUNNING,
        isDone: false,
        gameData: {},
        gameSecrets: {},
        playerStash: {},
    }

    /*
     * The runner gets the run once without a move. This allows
     * for initial state setup.
     */

    const runnerOutput = await runScript(
        context.gameDetails.runnerType,
        context.gameDetails.path,
        undefined,
        DEBUG_MODE,
    )

    const parsedInitRunnerOut: RunnerOutput = JSON.parse(runnerOutput.stdout)

    runnerState.gameSecrets = parsedInitRunnerOut.gameSecrets ?? {}
    runnerState.gameData = parsedInitRunnerOut.gameData ?? {}

    const playerName = context.challenger
    const actions = []
    addMark('game-loop-start')
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

        console.group(`Turn ${runnerState.turn}: ${playerName} plays`)

        const { stdout: playerStdout } = await runScript(
            playerConfig.runnerType,
            playerConfig.runnerPath,
            [
                {
                    gameData: runnerState.gameData,
                    stash: runnerState.playerStash,
                },
            ],
            DEBUG_MODE,
        )

        const parsedPlayerStdout: PlayerOutput = JSON.parse(playerStdout)

        // Update the player's stash with the lastest returned version.
        runnerState.playerStash = parsedPlayerStdout.stash

        console.log(`Turn output: ${playerStdout}`)
        actions.push(parsedPlayerStdout.action)
        const { stdout: runnerStdout, stderr } = await runScript(
            context.gameDetails.runnerType,
            context.gameDetails.path,
            [
                runnerState.gameSecrets,
                runnerState.gameData,
                'player',
                parsedPlayerStdout.action,
            ],
            DEBUG_MODE,
        )

        console.log(stderr)

        const parsedRunnerStdout: RunnerOutput = JSON.parse(runnerStdout)

        if (parsedRunnerStdout.gameSecrets)
            runnerState.gameSecrets = parsedRunnerStdout.gameSecrets
        if (parsedRunnerStdout.gameData)
            runnerState.gameData = parsedRunnerStdout.gameData
        if (parsedRunnerStdout.runnerState) {
            runnerState.isDone = parsedRunnerStdout.runnerState.done
            runnerState.outcome = parsedRunnerStdout.runnerState
                .outcome as GameOutcomes
        }

        console.log(`New game state: ${JSON.stringify(runnerState.gameData)}`)

        if (DEBUG_MODE)
            console.log(
                `New game secrets: ${JSON.stringify(runnerState.gameSecrets)}`,
            )

        console.groupEnd()

        /*
         * In the case where the game is a runaway (i.e. 50 turns without a
         * conclusion), the game is declared a draw.
         */
        if (runnerState.turn >= 50) {
            runnerState.isDone = true
            runnerState.outcome = GameOutcomes.TIME_OUT
        }
    }
    addMark('game-loop-end')
    const gameTime = timeBetween('game-loop-start', 'game-loop-end')

    const preSummaryStatusUpdate = await getIssueComment(context)

    const summaryStatusUpdate = `${preSummaryStatusUpdate}\n:ballot_box_with_check: Run game (${gameTime}s)\n## Game summary\n### ${
        GAME_OUTCOME_MESSAGES[
            runnerState.outcome as GameOutcomes.WIN | GameOutcomes.TIME_OUT
        ]
    }\n\`\`\`\nTurns played: ${
        runnerState.turn
    }\n\`\`\`\n<details><summary>Moves</summary>${actions
        .map(
            (item: any, index: any) =>
                `Turn ${index} - ${JSON.stringify(item)}`,
        )
        .join('</br>')}</details>`

    await upsertIssueComment(
        context.repoOwner,
        context.repoName,
        context.pullNumber,
        summaryStatusUpdate,
        context.commentId,
    )
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
