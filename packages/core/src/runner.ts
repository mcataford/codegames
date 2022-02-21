import {
    collectBranch,
    getIssueComment,
    readJSON,
    runScript,
    setupTimers,
    upsertIssueComment,
    writeJSON,
} from './utils'
import {
    Context,
    PlayerConfigMap,
    PlayerLabel,
    PlayerOutput,
    RunnableConfig,
    RunnerOutput,
} from './types'

const GAME_ROOT = './branches/game'
const P1_ROOT = '.'
const P2_ROOT = './branches/player2'

function determineCurrentPlayer(turnCount: number): PlayerLabel {
    return turnCount % 2 ? PlayerLabel.P1 : PlayerLabel.P2
}

function generatePlayerState(currentPlayer: PlayerLabel, state: any): any {
    return {
        gameData: state.gameData,
        stash: state.playerStash[currentPlayer],
    }
}

/*
 * run implements the game loop and manages the higher-level state of
 * the game.
 */
async function run(challengeContextPath: string) {
    const { addMark, timeBetween } = setupTimers()
    const context = await readJSON<Context>(challengeContextPath)

    addMark('pre-collect')
    await Promise.all([
        collectBranch(context.runnerBranch, GAME_ROOT),
        collectBranch(context.challengeeBranch, P2_ROOT),
    ])

    const [p1Config, p2Config] = await Promise.all([
        readJSON<RunnableConfig>(`${P1_ROOT}/player.config.json`),
        readJSON<RunnableConfig>(`${P2_ROOT}/player.config.json`),
    ])

    const configs: PlayerConfigMap = {
        [PlayerLabel.P1]: p1Config,
        [PlayerLabel.P2]: p2Config,
    }

    addMark('post-collect')
    const postFetchCode = timeBetween('pre-collect', 'post-collect')

    const preFetchStatusUpdate = await getIssueComment(context)

    const fetchStatusUpdate = `${preFetchStatusUpdate}\n:ballot_box_with_check: Fetch players and game branches (${postFetchCode}s)`

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
        winner: PlayerLabel | null
        outcome: string | null
        isDone: boolean
        gameData: any
        gameSecrets: any
        playerStash: any
    } = {
        turn: 0,
        winner: null,
        outcome: null,
        isDone: false,
        gameData: {},
        gameSecrets: {},
        playerStash: { [PlayerLabel.P1]: null, [PlayerLabel.P2]: null },
    }

    /*
     * The runner gets the run once without a move. This allows
     * for initial state setup.
     */

    const runnerOutput = await runScript(
        context.gameDetails.runnerType,
        context.gameDetails.path,
    )

    const parsedInitRunnerOut: RunnerOutput = JSON.parse(runnerOutput.stdout)

    runnerState.gameSecrets = parsedInitRunnerOut.gameSecrets ?? {}
    runnerState.gameData = parsedInitRunnerOut.gameData ?? {}

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
        const currentPlayer = determineCurrentPlayer(runnerState.turn)
        const playerConfig = configs[currentPlayer]
        const playerName =
            currentPlayer === PlayerLabel.P1
                ? context.challenger
                : context.challengee

        console.group(`Turn ${runnerState.turn}: ${playerName} plays`)

        const playerState = generatePlayerState(currentPlayer, runnerState)
        const { stdout: playerStdout } = await runScript(
            playerConfig.runnerType,
            playerConfig.runnerPath,
            [playerState],
        )

        const parsedPlayerStdout: PlayerOutput = JSON.parse(playerStdout)

        // Update the player's stash with the lastest returned version.
        runnerState.playerStash[currentPlayer] = parsedPlayerStdout.stash

        console.log(`Active player: ${p1Config.runnerPath}`)
        console.log(`Turn output: ${playerStdout}`)

        const { stdout: runnerStdout } = await runScript(
            context.gameDetails.runnerType,
            context.gameDetails.path,
            [
                runnerState.gameSecrets,
                runnerState.gameData,
                parsedPlayerStdout.action,
            ],
        )

        const parsedRunnerStdout: RunnerOutput = JSON.parse(runnerStdout)

        if (parsedRunnerStdout.gameSecrets)
            runnerState.gameSecrets = parsedRunnerStdout.gameSecrets
        if (parsedRunnerStdout.gameData)
            runnerState.gameData = parsedRunnerStdout.gameData
        if (parsedRunnerStdout.runnerState) {
            runnerState.isDone = parsedRunnerStdout.runnerState.done
            runnerState.outcome = parsedRunnerStdout.runnerState.outcome
        }

        console.log(`New game state: ${JSON.stringify(runnerState.gameData)}`)
        console.groupEnd()
    }
    addMark('game-loop-end')
    const gameTime = timeBetween('game-loop-start', 'game-loop-end')

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
        gameTime,
    }

    const outcomeMessage = winner
        ? `:tada::tada: ${winner} wins this round! :tada::tada:`
        : ":sweat_smile: Womp womp. It's a draw!"

    const preSummaryStatusUpdate = await getIssueComment(context)

    const summaryStatusUpdate = `${preSummaryStatusUpdate}\n:ballot_box_with_check: Run game (${gameTime}s)\n## Game summary\n### ${outcomeMessage}\n\`\`\`\nTurns played: ${summary.turnsPlayed}\n\`\`\``

    await upsertIssueComment(
        context.repoOwner,
        context.repoName,
        context.pullNumber,
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
