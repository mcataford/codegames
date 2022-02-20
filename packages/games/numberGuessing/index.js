if (process.argv.length < 4) {
    console.log(
        JSON.stringify({
            gameSecrets: { correct: Math.floor(Math.random() * 10) },
        }),
    )
    process.exit(0)
}

const correct = JSON.parse(
    Buffer.from(process.argv[2], 'base64').toString('utf8'),
)
const state = JSON.parse(
    Buffer.from(process.argv[3], 'base64').toString('utf8'),
)
const guess = JSON.parse(
    Buffer.from(process.argv[4], 'base64').toString('utf8'),
)

if (correct.correct === guess.guess)
    console.log(
        JSON.stringify({ done: true, gameSecrets: { decision: 'win' } }),
    )
else console.log(JSON.stringify({ done: false }))
