if (process.argv.length < 4) {
    console.log(
        JSON.stringify({
            gameSecrets: { correct: Math.floor(Math.random() * 10) },
        }),
    )
    process.exit(0)
}

const correct = JSON.parse(process.argv[2])
const state = JSON.parse(process.argv[3])
const guess = JSON.parse(process.argv[4])

if (correct.correct === guess.guess)
    console.log(
        JSON.stringify({ done: true, gameSecrets: { decision: 'win' } }),
    )
else console.log(JSON.stringify({ done: false }))
