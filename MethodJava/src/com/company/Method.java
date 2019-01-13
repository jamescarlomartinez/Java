package com.company;

public class Method {

    String name;
    String model;
    String color;
    int tyres;

    void Method1()
    {
        System.out.println("this is method1");
    }

    void Method2()
    {
        System.out.println("this is method2");
    }

    void Method3()
    {
        System.out.println("this is method3");
    }

    public static void main(String[] args) {
        Method mainMethod = new Method();
        mainMethod.Method3();
        mainMethod.Method2();
        mainMethod.Method1();
    }




}
