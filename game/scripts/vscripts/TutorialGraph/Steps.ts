import { findAllPlayersID, setGoalsUI, setUnitVisibilityThroughFogOfWar } from "../util"
import * as tg from "./Core"

const isHeroNearby = (location: Vector, radius: number) => FindUnitsInRadius(
    DotaTeam.BADGUYS, location, undefined, radius,
    UnitTargetTeam.BOTH,
    UnitTargetType.HERO,
    UnitTargetFlags.INVULNERABLE + UnitTargetFlags.OUT_OF_WORLD + UnitTargetFlags.MAGIC_IMMUNE_ENEMIES,
    0, false
).length > 0

/**
 * Creates a tutorial step that waits for a hero to go to a location.
 * @param location Target location
 */
export const goToLocation = (location: tg.StepArgument<Vector>) => {
    let checkTimer: string | undefined = undefined

    return tg.step((context, complete) => {
        const actualLocation = tg.getArg(location, context)

        Tutorial.CreateLocationTask(actualLocation)

        // Wait until a hero is at the goal location
        const checkIsAtGoal = () => {
            if (isHeroNearby(actualLocation, 200)) {
                complete()
            } else {
                checkTimer = Timers.CreateTimer(1, () => checkIsAtGoal())
            }
        }

        checkIsAtGoal()
    }, context => {
        if (checkTimer) {
            Timers.RemoveTimer(checkTimer)
            checkTimer = undefined
        }
    })
}

/**
 * Creates a tutorial step that spawns a unit.
 * @param unitName Name of the unit to spawn.
 * @param spawnLocation Location to spawn the unit at.
 * @param team Team the unit belongs to.
 * @param entityKey Entity key for storing CBaseEntity member in the context.
 */
export const spawnUnit = (unitName: tg.StepArgument<string>, spawnLocation: tg.StepArgument<Vector>, team: tg.StepArgument<DotaTeam>, entityKey?: tg.StepArgument<string>) => {
    return tg.step((context, complete) => {
        const actualUnitName = tg.getArg(unitName, context)
        const actualSpawnLocation = tg.getArg(spawnLocation, context)
        const actualTeam = tg.getArg(team, context)
        const actualEntityKey = entityKey ? tg.getArg(entityKey, context) : undefined

        CreateUnitByNameAsync(actualUnitName, actualSpawnLocation, true, undefined, undefined, actualTeam,
            createdUnit => {

                if (actualEntityKey) {
                    context[actualEntityKey] = createdUnit
                }

                complete()
            }
        )
    })
}

/**
 * Creates a tutorial step that moves a unit.
 * @param unit The unit to move.
 * @param moveLocation Location to move the unit to.
 */
export const moveUnit = (unit: tg.StepArgument<CDOTA_BaseNPC>, moveLocation: tg.StepArgument<Vector>) => {
    let checkTimer: string | undefined = undefined
    let delayCheckTimer: string | undefined = undefined

    return tg.step((context, complete) => {
        const actualUnit = tg.getArg(unit, context)
        const actualMoveLocation = tg.getArg(moveLocation, context)

        const order: ExecuteOrderOptions = {
            UnitIndex: actualUnit.GetEntityIndex(),
            OrderType: UnitOrder.MOVE_TO_POSITION,
            Position: actualMoveLocation,
            Queue: true
        }

        ExecuteOrderFromTable(order)

        const checkIsIdle = () => {
            if (actualUnit && actualUnit.IsIdle()) {
                complete()
            } else {
                checkTimer = Timers.CreateTimer(1, () => checkIsIdle())
            }
        }

        delayCheckTimer = Timers.CreateTimer(0.1, () => checkIsIdle())
    },
        context => {
            if (checkTimer) {
                Timers.RemoveTimer(checkTimer)
                checkTimer = undefined
            }
            if (delayCheckTimer) {
                Timers.RemoveTimer(delayCheckTimer)
                delayCheckTimer = undefined
            }
        })
}

/**
 * Creates a tutorial step that spawns a unit and waits until it dies.
 * @param unitName Name of the unit to spawn.
 * @param spawnLocation Location to spawn the unit at.
 */
export const spawnAndKillUnit = (unitName: tg.StepArgument<string>, spawnLocation: tg.StepArgument<Vector>, visibleThroughFog?: tg.StepArgument<boolean>) => {
    let unit: CDOTA_BaseNPC | undefined = undefined
    let checkTimer: string | undefined = undefined

    return tg.step((context, complete) => {
        const actualUnitName = tg.getArg(unitName, context)
        const actualSpawnLocation = tg.getArg(spawnLocation, context)
        const actualVisibleThroughFog = tg.getOptionalArg(visibleThroughFog, context)

        unit = CreateUnitByName(actualUnitName, actualSpawnLocation, true, undefined, undefined, DotaTeam.NEUTRALS)

        if (actualVisibleThroughFog) {
            setUnitVisibilityThroughFogOfWar(unit, true);
        }

        // Wait until the unit dies
        const checkIsDead = () => {
            if (unit && !unit.IsAlive()) {
                complete()
            } else {
                checkTimer = Timers.CreateTimer(1, () => checkIsDead())
            }
        }

        checkIsDead()
    }, context => {
        if (checkTimer) {
            Timers.RemoveTimer(checkTimer)
            checkTimer = undefined
        }

        if (unit) {
            if (IsValidEntity(unit)) {
                unit.RemoveSelf()
            }

            unit = undefined
        }
    })
}

/**
 * Creates a tutorial step that changes a unit's face direction.
 * @param getUnitFunc Function that returns a CDota_BaseNPC entity.
 * @param faceTowards Point to face towards.
 */
export const faceTowards = (unit: tg.StepArgument<CDOTA_BaseNPC>, faceTowards: tg.StepArgument<Vector>) => {
    return tg.step((context, complete) => {
        const actualUnit = tg.getArg(unit, context)
        const actualFaceTowards = tg.getArg(faceTowards, context)

        actualUnit.FaceTowards(actualFaceTowards)
        complete()
    })
}

/**
 * Waits for an amount of time until completion
 * @param waitSeconds Time to wait before completion
 */
export const wait = (waitSeconds: tg.StepArgument<number>) => {
    let waitTimer: string | undefined = undefined

    return tg.step((context, complete) => {
        const actualWaitSeconds = tg.getArg(waitSeconds, context)
        waitTimer = Timers.CreateTimer(actualWaitSeconds, () => complete())
    }, context => {
        if (waitTimer) {
            Timers.RemoveTimer(waitTimer)
            waitTimer = undefined
        }
    })
}

/**
 * Focuses the camera to a target or frees it.
 * @param target Target to focus the camera on. Can be undefined for freeing the camera.
 */
export const setCameraTarget = (target: tg.StepArgument<CBaseEntity | undefined>) => {
    let playerIds: PlayerID[] | undefined = undefined

    return tg.step((context, complete) => {
        const actualTarget = tg.getArg(target, context)

        playerIds = findAllPlayersID()
        // Focus all cameras on the target
        playerIds.forEach(playerId => PlayerResource.SetCameraTarget(playerId, actualTarget))

        complete()
    }, context => {
        if (playerIds) {
            playerIds.forEach(playerId => PlayerResource.SetCameraTarget(playerId, undefined))
            playerIds = undefined
        }
    })
}

/**
 * Creates a tutorial step that waits for the hero to upgrade an ability
 * @param ability the ability that needs to be upgraded.
 */
export const upgradeAbility = (ability: CDOTABaseAbility) => {
    let checkTimer: string | undefined = undefined
    let abilityLevel = ability.GetLevel();
    const desiredLevel = ability.GetLevel() + 1;

    return tg.step((context, complete) => {
        const checkAbilityLevel = () => {
            abilityLevel = ability.GetLevel();
            if (desiredLevel == abilityLevel) {
                complete();
            } else {
                checkTimer = Timers.CreateTimer(.1, () => checkAbilityLevel())
            }
        }
        checkAbilityLevel();
    }, context => {
        if (checkTimer) {
            Timers.RemoveTimer(checkTimer)
            checkTimer = undefined
        }
    })
}

/**
 * Waits for the player to move their camera from its initial location.
 */
export const waitForCameraMovement = () => {
    let listenerId: CustomGameEventListenerID | undefined = undefined

    return tg.step((context, complete) => {
        listenerId = CustomGameEventManager.RegisterListener("camera_movement_detected", _ => {
            if (listenerId) {
                CustomGameEventManager.UnregisterListener(listenerId)
                listenerId = undefined
            }
            complete()
        })

        CustomGameEventManager.Send_ServerToAllClients("detect_camera_movement", {});
    }, context => {
        if (listenerId) {
            CustomGameEventManager.UnregisterListener(listenerId)
            listenerId = undefined
        }
    })
}

/**
 * Calls a function and completes immediately.
 * @param fn Function to call. Gets passed the context.
 * @param stopFn Optional function to call on stop. Gets passed the context.
 */
export const immediate = (fn: (context: tg.TutorialContext) => void, stopFn?: (context: tg.TutorialContext) => void) => {
    return tg.step((context, complete) => {
        fn(context)
        complete()
    }, context => {
        if (stopFn) {
            stopFn(context)
        }
    })
}

/**
 * Plays a global sound and optionally waits for its completion.
 * @param soundName Name of the sound
 * @param waitForCompletion Whether to wait for the sound to complete or not. Default is false.
 * @param extraDelaySeconds Extra delay to add to the wait time if true was passed for waitForCompletion. Defaults to 0.5s.
 */
export const playGlobalSound = (soundName: tg.StepArgument<string>, waitForCompletion?: tg.StepArgument<boolean>, extraDelaySeconds?: tg.StepArgument<number>) => {
    const defaultExtraDelaySeconds = 0.5
    let waitTimer: string | undefined = undefined

    return tg.step((context, complete) => {
        const actualSoundName = tg.getArg(soundName, context)
        const actualWaitForCompletion = tg.getOptionalArg(waitForCompletion, context)
        const actualExtraDelaySeconds = tg.getOptionalArg(extraDelaySeconds, context)

        EmitGlobalSound(actualSoundName)

        if (actualWaitForCompletion) {
            // Get any entity so we can get the duration of the sound (not sure why that's needed)
            const anyEntity = Entities.Next(undefined)
            if (!anyEntity) {
                error("Could not find any entity to get duration of sound")
            }

            const soundDuration = anyEntity.GetSoundDuration(actualSoundName, "") + (actualExtraDelaySeconds !== undefined ? actualExtraDelaySeconds : defaultExtraDelaySeconds)

            waitTimer = Timers.CreateTimer(soundDuration, () => complete())
        } else {
            complete()
        }
    }, context => {
        if (waitTimer) {
            Timers.RemoveTimer(waitTimer)
            waitTimer = undefined
        }
    })
}

export const completeOnCheck = (checkFn: (context: tg.TutorialContext) => boolean, checkPeriodSeconds: tg.StepArgument<number>) => {
    let checkTimer: string | undefined = undefined

    return tg.step((context, complete) => {
        const actualCheckPeriodSeconds = tg.getArg(checkPeriodSeconds, context)

        // Wait until the check is true
        const check = () => {
            if (checkFn(context)) {
                complete()
            } else {
                checkTimer = Timers.CreateTimer(actualCheckPeriodSeconds, () => check())
            }
        }

        check()
    }, context => {
        if (checkTimer) {
            Timers.RemoveTimer(checkTimer)
            checkTimer = undefined
        }
    })
}

/**
 * Updates the goal UI periodically using the given function returning goals. Never completes and should be used together with forkAny().
 * @param getGoals Goals or function returning goals that gets called periodically to display in the UI.
 */
export const trackGoals = (goals: tg.StepArgument<Goal[]>) => {
    let timer: string | undefined = undefined

    return tg.step((context, complete) => {
        const track = () => {
            const actualGoals = tg.getArg(goals, context)
            setGoalsUI(actualGoals)

            timer = Timers.CreateTimer(0.5, () => track())
        }

        track()
    }, context => {
        if (timer) {
            Timers.RemoveTimer(timer)
            timer = undefined
        }

        setGoalsUI([])
    })
}
