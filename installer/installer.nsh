!macro customInit
  ; Kill the running Workflow Studio process before installing
  nsExec::ExecToLog 'taskkill /F /IM "Workflow Studio.exe"'
  Sleep 1000
!macroend
