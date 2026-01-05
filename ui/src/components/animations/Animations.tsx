import React from 'react';
/**
 * PtolemyLoadingSpinner - A loading animation component with neon trail effects
 *
 * This component displays the Ptolemy logo with animated spinning circles
 * that create a neon trail effect. It's used to indicate loading states
 * throughout the application.
 *
 * @param {Object} props - Component props
 * @param {string} props.size - Size variant ('sm', 'md', 'lg')
 * @param {string} props.logoSrc - Source URL for the logo image
 * @param {string} props.className - Additional CSS classes
 */
export const PtolemyLoadingSpinner: React.FC<{
  size?: 'sm' | 'md' | 'lg';
  logoSrc?: string;
  className?: string;
}> = ({
  size = 'md',
  logoSrc = "/logo-neon.png",
  className = ''
}) => {
  // Size mappings for the container and logo
  const sizeMap = {
    sm: {
      container: 'w-8 h-8',
      logo: 'w-5 h-5'
    },
    md: {
      container: 'w-10 h-10',
      logo: 'w-7 h-7'
    },
    lg: {
      container: 'w-14 h-14',
      logo: 'w-9 h-9'
    }
  };
  return <div className={`relative ${sizeMap[size].container} flex items-center justify-center ${className}`}>
      {/* Central logo */}
      <img src={logoSrc} alt="Loading" className={`${sizeMap[size].logo} z-10 relative`} />
      {/* Animated spinning circles with neon trail effects */}
      <div className="absolute inset-0 w-full h-full">
        {/* First circle - cyan with clockwise rotation */}
        <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-cyan-400 animate-[spin_0.8s_linear_infinite] blur-[0.5px] after:content-[''] after:absolute after:inset-0 after:rounded-full after:border-2 after:border-transparent after:border-t-cyan-400/30 after:blur-[3px] after:scale-110"></div>
        {/* Second circle - fuchsia with counter-clockwise rotation */}
        <div className="absolute inset-0 rounded-full border-2 border-transparent border-r-fuchsia-400 animate-[spin_0.6s_linear_infinite_reverse] blur-[0.5px] after:content-[''] after:absolute after:inset-0 after:rounded-full after:border-2 after:border-transparent after:border-r-fuchsia-400/30 after:blur-[3px] after:scale-110"></div>
      </div>
    </div>;
};
/**
 * NeonGlowEffect - A component that adds a neon glow effect to its children
 *
 * This component creates a container with a neon glow effect in different colors.
 * It's used for highlighting UI elements with a cyberpunk/neon aesthetic.
 *
 * @param {Object} props - Component props
 * @param {React.ReactNode} props.children - Child elements
 * @param {string} props.color - Color variant ('cyan', 'fuchsia', 'blue', 'purple', 'green', 'pink')
 * @param {string} props.intensity - Glow intensity ('low', 'medium', 'high')
 * @param {string} props.className - Additional CSS classes
 */
export const NeonGlowEffect: React.FC<{
  children: React.ReactNode;
  color?: 'cyan' | 'fuchsia' | 'blue' | 'purple' | 'green' | 'pink';
  intensity?: 'low' | 'medium' | 'high';
  className?: string;
}> = ({
  children,
  color = 'blue',
  intensity = 'medium',
  className = ''
}) => {
  // Color mappings for different neon colors
  const colorMap = {
    cyan: 'border-border',
    fuchsia: 'border-border',
    blue: 'border-border',
    purple: 'border-border',
    green: 'border-border',
    pink: 'border-border'
  };
  // Intensity mappings for glow strength
  const intensityMap = {
    low: '',
    medium: '',
    high: ''
  };
  return <div className={`relative ${className}`}>
      <div className={`absolute inset-0 rounded-md border ${colorMap[color]} ${intensityMap[intensity]}`}></div>
      <div className="relative z-10">{children}</div>
    </div>;
};
/**
 * EdgeLitEffect - A component that adds an edge-lit glow effect
 *
 * This component creates a thin glowing line at the top of a container,
 * simulating the effect of edge lighting.
 *
 * @param {Object} props - Component props
 * @param {string} props.color - Color variant ('blue', 'purple', 'green', 'pink')
 * @param {string} props.className - Additional CSS classes
 */
export const EdgeLitEffect: React.FC<{
  color?: 'blue' | 'purple' | 'green' | 'pink';
  className?: string;
}> = ({
  color = 'blue',
  className = ''
}) => {
  // Color mappings for different edge-lit colors
  const colorMap = {
    blue: 'bg-border',
    purple: 'bg-border',
    green: 'bg-border',
    pink: 'bg-border'
  };
  return <div className={`absolute top-0 left-0 w-full h-[2px] ${colorMap[color]} ${className}`}></div>;
};
