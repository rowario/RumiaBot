IF EXIST node_modules (
	npm start
) ELSE (
	npm install & npm start
)
