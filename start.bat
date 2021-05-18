IF EXIST node_modules (
	npm start
) ELSE (
	npm run install & npm start
)
