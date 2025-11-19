import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { APP_INITIALIZER, inject, NgModule } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MAT_FORM_FIELD_DEFAULT_OPTIONS } from '@angular/material/form-field';
import { BrowserModule } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { AlertModule, CloudAppTranslateModule, InitService, MaterialModule } from '@exlibris/exl-cloudapp-angular-lib';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { MainComponent } from './main/main.component';
import { UploadComponent } from './upload/upload.component';
import { ProcessingComponent } from './processing/processing.component';

@NgModule({
    declarations: [
        AppComponent,
        MainComponent
    ],
    bootstrap: [AppComponent],
    imports: [
        MaterialModule,
        BrowserModule,
        BrowserAnimationsModule,
        AppRoutingModule,
        AlertModule,
        FormsModule,
        ReactiveFormsModule,
        CloudAppTranslateModule.forRoot(),
        UploadComponent,
        ProcessingComponent
    ],
    providers: [
        { provide: APP_INITIALIZER, useFactory: () => () => true, deps: [InitService], multi: true },
        { provide: MAT_FORM_FIELD_DEFAULT_OPTIONS, useValue: { appearance: 'fill' } },
        provideHttpClient(withInterceptorsFromDi())
    ]
})
export class AppModule { }
