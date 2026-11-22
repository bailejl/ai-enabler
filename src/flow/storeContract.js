// The contract every project store adapter meets, as plain async checks with no test framework, so
// Vitest runs them on the memory adapter and the browser runs them on the IndexedDB adapter. Each
// check gets a fresh, empty adapter and returns null when it passes, or a sentence saying what
// went wrong.

const entry = (id, name, modifiedAt = '2026-11-22T10:00:00.000Z') => ({ id, name, modifiedAt })

const sameJson = (left, right) => JSON.stringify(left) === JSON.stringify(right)

const byId = (left, right) => left.id.localeCompare(right.id)

const putThenGet = async (adapter) => {
  await adapter.put(entry('a', 'Alpha'), 'text a')
  const text = await adapter.getFile('a')
  const index = await adapter.listIndex()
  if (text !== 'text a') return `getFile after put returned ${JSON.stringify(text)}`
  if (!sameJson(index, [entry('a', 'Alpha')]))
    return `listIndex after put was ${JSON.stringify(index)}`
  return null
}

const putReplaces = async (adapter) => {
  await adapter.put(entry('a', 'Alpha'), 'old')
  await adapter.put(entry('a', 'Beta', '2026-11-23T10:00:00.000Z'), 'new')
  const text = await adapter.getFile('a')
  const index = await adapter.listIndex()
  if (text !== 'new') return `getFile after a second put returned ${JSON.stringify(text)}`
  if (!sameJson(index, [entry('a', 'Beta', '2026-11-23T10:00:00.000Z')])) {
    return `listIndex after a second put was ${JSON.stringify(index)}`
  }
  return null
}

const removeDrops = async (adapter) => {
  await adapter.put(entry('a', 'Alpha'), 'text a')
  await adapter.put(entry('b', 'Beta'), 'text b')
  await adapter.remove('a')
  const removed = await adapter.getFile('a')
  const index = await adapter.listIndex()
  if (removed !== undefined) return `getFile after remove returned ${JSON.stringify(removed)}`
  if (!sameJson(index, [entry('b', 'Beta')]))
    return `listIndex after remove was ${JSON.stringify(index)}`
  return null
}

const removeUnknown = async (adapter) => {
  await adapter.put(entry('a', 'Alpha'), 'text a')
  await adapter.remove('nope')
  const index = await adapter.listIndex()
  if (!sameJson(index, [entry('a', 'Alpha')])) {
    return `listIndex after removing an unknown id was ${JSON.stringify(index)}`
  }
  return null
}

const listsEvery = async (adapter) => {
  await adapter.put(entry('b', 'Beta'), 'text b')
  await adapter.put(entry('a', 'Alpha'), 'text a')
  const index = [...(await adapter.listIndex())].sort(byId)
  if (!sameJson(index, [entry('a', 'Alpha'), entry('b', 'Beta')])) {
    return `listIndex with two projects was ${JSON.stringify(index)}`
  }
  return null
}

const missingFile = async (adapter) => {
  const text = await adapter.getFile('nope')
  return text === undefined ? null : `getFile for an unknown id returned ${JSON.stringify(text)}`
}

/** The contract's checks by name. Run each on its own fresh adapter. */
export const STORE_CONTRACT = Object.freeze({
  'put then get': putThenGet,
  'put replaces': putReplaces,
  'remove drops': removeDrops,
  'remove of an unknown id changes nothing': removeUnknown,
  'list holds every project': listsEvery,
  'get of an unknown id is undefined': missingFile,
})

/**
 * Runs every check, each on an adapter from `makeAdapter()`, and returns the failures as
 * `{ check, failure }`; an empty list means the adapter meets the contract.
 */
export const runStoreContract = async (makeAdapter) => {
  const outcomes = []
  for (const [check, run] of Object.entries(STORE_CONTRACT)) {
    const failure = await run(await makeAdapter())
    if (failure !== null) outcomes.push({ check, failure })
  }
  return outcomes
}
