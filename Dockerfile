FROM node:20-alpine

# Alpine-ൽ പൈത്തണും മേക്ക് ഫയലുകളും ഇൻസ്റ്റാൾ ചെയ്യുക (Error ഒഴിവാക്കാൻ)
RUN apk add --no-cache python3 make g++

WORKDIR /app

COPY package*.json ./

# Python ചെക്ക് ഒഴിവാക്കാനുള്ള എൻവയോൺമെന്റ് സെറ്റിങ്
ENV YOUTUBE_DL_SKIP_PYTHON_CHECK=1

RUN npm install

COPY . .

EXPOSE 8000

CMD ["npm", "start"]
