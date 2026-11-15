export const DEFAULT_PROJECT_NAME = 'Untitled Project'

export const createStarterProject = ({ newId = () => crypto.randomUUID() } = {}) => ({
  id: newId(),
  name: DEFAULT_PROJECT_NAME,
})
