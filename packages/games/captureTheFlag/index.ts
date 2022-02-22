type GameGrid = any

enum Direction {
    RIGHT = 'right',
    LEFT = 'left',
    UP = 'up',
    DOWN = 'down',
}

type Coordinates = [number, number]

interface PlayerAction {
    move: Direction
}

interface GameSecrets {
    grid: GameGrid
    pointsOfInterest: {
        [key: string]: Coordinates
    }
}

function initialize() {
    const grid: GameGrid = []

    for (let y = 0; y < 5; y++) {
        grid.push([])
        for (let x = 0; x < 5; x++) {
            grid[y].push(null)
        }
    }

    const flagX = Math.floor(Math.random() * 5)
    const flagY = Math.floor(Math.random() * 5)

    grid[flagY][flagX] = 'FLAG'

    const p1X = Math.floor(Math.random() * 5)
    const p1Y = Math.floor(Math.random() * 5)
    const p2X = Math.floor(Math.random() * 5)
    const p2Y = Math.floor(Math.random() * 5)

    const pointsOfInterest = {
        'player-1': [p1Y, p1X],
        'player-2': [p2Y, p2X],
        flag: [flagY, flagX],
    }

    grid[p1Y][p1X] = 'P1'

    grid[p2Y][p2X] = 'P2'

    console.log(JSON.stringify({ gameSecrets: { grid, pointsOfInterest } }))
}

function getVicinity(gameGrid: GameGrid, epicenter: Coordinates): any {
    const [fromY, toY] = [
        Math.max(epicenter[0] - 1, 0),
        Math.min(epicenter[0] + 1, gameGrid.length),
    ]
    const [fromX, toX] = [
        Math.max(epicenter[1] - 1, 0),
        Math.min(epicenter[1] + 1, gameGrid.length),
    ]

    return gameGrid
        .slice(fromY, toY + 1)
        .map((row: string[]) => row.slice(fromX, toX + 1))
}

function applyAction(
    gameData: any,
    gameSecrets: GameSecrets,
    currentPlayer: string,
    action: PlayerAction,
) {
    const currentPosition = gameSecrets.pointsOfInterest[currentPlayer]

    const newPosition: Coordinates = [...currentPosition]

    if (action.move === Direction.UP) newPosition[0]--
    else if (action.move === Direction.DOWN) newPosition[0]++
    else if (action.move === Direction.LEFT) newPosition[1]--
    else if (action.move === Direction.RIGHT) newPosition[1]++

    if (
        newPosition[0] < 0 ||
        newPosition[0] >= 5 ||
        newPosition[1] < 0 ||
        newPosition[1] >= 5
    )
        console.log(JSON.stringify({ gameSecrets }))
    else {
        gameSecrets.grid[currentPosition[0]][currentPosition[1]] = null
        gameSecrets.grid[newPosition[0]][newPosition[1]] = currentPlayer
        gameSecrets.pointsOfInterest[currentPlayer] = newPosition

        gameData[currentPlayer] = {
            vicinity: getVicinity(gameSecrets.grid, newPosition),
        }

        console.log(JSON.stringify({ gameData, gameSecrets }))
    }
}

if (process.argv.length < 3) initialize()
else {
    const gameSecrets = JSON.parse(process.argv[2])
    const gameData = JSON.parse(process.argv[3])
    const playerAction = JSON.parse(process.argv[4])

    applyAction(gameData, gameSecrets, 'player-1', playerAction)
}
