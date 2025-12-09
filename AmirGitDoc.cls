\NeedsTeXFormat{LaTeX2e}
\ProvidesClass{AmirGitDoc}[2025/12/09 Private Amir document class]

% Pass all options to article
\DeclareOption*{\PassOptionsToClass{\CurrentOption}{article}}
\ProcessOptions\relax

\LoadClass{article}

% Core packages and styling
\RequirePackage{amsmath}
\RequirePackage{geometry}
\geometry{margin=0.5in}

\RequirePackage{xcolor}
\definecolor{burgundy}{rgb}{0.5,0,0.13}
\definecolor{navy}{rgb}{0.0,0.0,0.5}
\definecolor{lightred}{rgb}{1.0,0.93,0.93}
% Placeholder hook for additional user colors
\newcommand{\AmirGitDocSetupColors}{}

\RequirePackage{titlesec}
\titleformat{\section}
  {\color{burgundy}\normalfont\Large\bfseries}
  {\thesection}{1em}{}
\titleformat{\subsection}
  {\color{green!50!black}\normalfont\large\bfseries}
  {\thesubsection}{1em}{}

\RequirePackage{titling}
\pretitle{\begin{center}}
\posttitle{\end{center}}

\RequirePackage{hyperref}
\hypersetup{linktoc=all, urlcolor=red}

\RequirePackage{tocloft}
\renewcommand{\cftsecfont}{\color{burgundy}}
\renewcommand{\cftsubsecfont}{\color{green!50!black}}
\renewcommand{\cftsecpagefont}{\color{blue}}
\renewcommand{\cftsubsecpagefont}{\color{blue}}
\setlength{\cftbeforesecskip}{0pt}
\setlength{\cftbeforesubsecskip}{0pt}

\RequirePackage{fancyhdr}
\RequirePackage{lastpage}
\pagestyle{fancy}
\fancyhf{}
\renewcommand{\headrulewidth}{0pt}
\renewcommand{\footrulewidth}{0.4pt}
\fancyfoot[R]{\small\textcolor{gray}{page \thepage\ out of \pageref{LastPage}}}
\fancypagestyle{plain}{%
  \fancyhf{}%
  \renewcommand{\headrulewidth}{0pt}%
  \renewcommand{\footrulewidth}{0.4pt}%
  \fancyfoot[R]{\small\textcolor{gray}{page \thepage\ out of \pageref{LastPage}}}%
}

% Convenience macro for boxed TOC
\newcommand{\AmirGitDocToc}{%
  \begin{center}
  \fcolorbox{burgundy}{lightred}{%
    \begin{minipage}{0.95\linewidth}
      \vspace{0.3em}%
      \tableofcontents
      \vspace{0.2em}%
    \end{minipage}}%
  \end{center}}

% Graphics and figures
\RequirePackage{graphicx}
\RequirePackage{tikz}
\usetikzlibrary{positioning,arrows.meta}

% Bibliography styling
\RequirePackage[backend=biber,style=numeric,sorting=none,doi=false,url=false]{biblatex}
\newcommand{\biblinklabel}[1]{%
\iffieldundef{url}
{\iffieldundef{doi}{#1}{\href{https://doi.org/\thefield{doi}}{#1}}}
{\href{\thefield{url}}{#1}}}
% Bibliography labels: red number hyperlinked, brackets applied only once
\DeclareFieldFormat{labelnumber}{\biblinklabel{\textcolor{red}{#1}}}
\DeclareFieldFormat{labelnumberwidth}{\mkbibbrackets{\biblinklabel{\textcolor{red}{#1}}}}
% In-text \cite uses red, bracketed numeric labels linked to bibliography
\DeclareCiteCommand{\cite}
{\usebibmacro{prenote}}
{\mkbibbrackets{\printtext[bibhyperref]{\textcolor{red}{\thefield{labelnumber}}}}}
{\multicitedelim}
{\usebibmacro{postnote}}

% Title helpers
\makeatletter
\def\@projectname{RadQy Project}
\def\@email{}
\newcommand{\projectname}[1]{\def\@projectname{#1}}
\newcommand{\email}[1]{\def\@email{#1}}

\renewcommand{\maketitle}{%
  \begin{center}%
    \normalfont \normalsize
    \textsc{\color{burgundy}{\@projectname}}\\[1pt]%
    \rule{\linewidth}{1pt}\\[1pt]%
    {\huge \bfseries \color{navy} \@title}\\%
    {\color{navy}\rule{\linewidth}{3pt}}\\[1pt]%
    {\large \@author}\\%
    \ifx\@email\@empty\relax\else
      \href{mailto:\@email}{\textcolor{red}{\texttt{\footnotesize \@email}}}\\%
    \fi
    {\normalsize \@date}%
  \end{center}%
}
\makeatother
