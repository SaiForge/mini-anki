import { useContext } from 'react';
import { ThemeContext } from '../context/ThemeContext';
import { Moon, Sun } from 'lucide-react';

export default function ThemeToggle() {
    const { theme, toggleTheme } = useContext(ThemeContext);

    return (
        <button
            type="button"
            className="ma-nav-link"
            onClick={toggleTheme}
            title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
        >
            {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
        </button>
    );
}
