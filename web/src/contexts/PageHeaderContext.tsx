import React, { createContext, useContext } from 'react';
import type { ReactNode } from 'react';

interface PageHeaderContextType {
  title?: string;
  subtitle?: string;
  setPageHeader: (config: {
    title?: string;
    subtitle?: string;
  }) => void;
  clearPageHeader: () => void;
}

const PageHeaderContext = createContext<PageHeaderContextType | undefined>(
  undefined
);

export const PageHeaderProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [title, setTitle] = React.useState<string>();
  const [subtitle, setSubtitle] = React.useState<string>();

  const setPageHeader = (config: {
    title?: string;
    subtitle?: string;
  }) => {
    setTitle(config.title);
    setSubtitle(config.subtitle);
  };

  const clearPageHeader = () => {
    setTitle(undefined);
    setSubtitle(undefined);
  };

  return (
    <PageHeaderContext.Provider
      value={{
        title,
        subtitle,
        setPageHeader,
        clearPageHeader,
      }}
    >
      {children}
    </PageHeaderContext.Provider>
  );
};

export const usePageHeader = () => {
  const context = useContext(PageHeaderContext);
  if (!context) {
    throw new Error(
      'usePageHeader must be used within PageHeaderProvider'
    );
  }
  return context;
};
