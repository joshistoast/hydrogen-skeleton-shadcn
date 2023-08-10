import { Button } from './ui/button'
import { useTheme } from './ThemeContext'
import { Icon } from '@iconify/react'

export default function ThemeToggle () {
  const { toggleTheme } = useTheme()

  return (
    <Button variant="ghost" size="icon" onClick={toggleTheme}>
      <Icon icon="lucide:sun-medium" className="w-4 h-4 transition-all duration-500 scale-100 rotate-0 dark:-rotate-90 dark:scale-0" />
      <Icon icon="lucide:moon" className="absolute w-4 h-4 transition-all duration-500 scale-0 rotate-90 dark:rotate-0 dark:scale-100" />
      <span className="sr-only">Toggle theme</span>
    </Button>
  )
}
