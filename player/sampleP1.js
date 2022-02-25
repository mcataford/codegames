function play() {
    const rng = Math.random()

    if (rng < 0.25) console.log(JSON.stringify({ action: { move: 'down' } }))
    else if (rng < 0.5)
        console.log(JSON.stringify({ action: { move: 'left' } }))
    else if (rng < 0.75) console.log(JSON.stringify({ action: { move: 'up' } }))
    else console.log(JSON.stringify({ action: { move: 'right' } }))
}

play()
