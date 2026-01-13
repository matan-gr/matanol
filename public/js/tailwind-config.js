
// Wait for the window to load if tailwind isn't immediately available,
// though script ordering in index.html usually handles this.
if (window.tailwind) {
  window.tailwind.config = {
    darkMode: 'class',
    theme: {
      extend: {
        fontFamily: {
          sans: ['Inter', 'sans-serif'],
          mono: ['JetBrains Mono', 'monospace'],
        }
      }
    }
  };
} else {
  // Fallback: If for some reason scripts load out of order/async
  window.addEventListener('load', function() {
    if (window.tailwind) {
      window.tailwind.config = {
        darkMode: 'class',
        theme: {
          extend: {
            fontFamily: {
              sans: ['Inter', 'sans-serif'],
              mono: ['JetBrains Mono', 'monospace'],
            }
          }
        }
      };
    }
  });
}
