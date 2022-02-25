# Capture the flag

## Rules

__Capture the flag__ is a two-player challenge in which the players must find the flag, randomly placed on a
NxN-sized map, before their opponent. Once retrieved, the flag must be brought back to their "home base" (i.e. where
they initially started the game).

At the beginning of the game, the players are placed at opposite ends of the arena and the flag is placed at a random
position near the middle of the map. Players then alternate in moving in a direction of their choosing until one of them lands on the flag. At this point, the player with the flag must come back to their home base without being touched by their opponent.

### Winning/losing conditions

If the player carrying the flag makes the way back without being tapped by the other player, they win. If the
other player touches them, the other player wins. If the game runs for longer than 50 turns, the game is a draw.

## Input/outputs

The players should write a script in the `<repo-root>/player` directory that will receive the game's state and output an action that follows the schema:

```typescript
{
    move: 'up' | 'down' | 'left' | 'right'
}
```

The received state includes the game's public state and a player-specific stash that can be used to persist data
between turns.
